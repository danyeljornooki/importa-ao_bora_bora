import { describe, expect, it, vi } from 'vitest';
import type { Document } from 'mongodb';
import { MONGO_COLLECTIONS } from '../../adapters/mongo/client/collectionNames';
import {
  buildMongoUpdateSnapshotDocument,
  countPendingMongoUpdateSnapshots,
  requireSnapshotTestRunId,
  rollbackMongoTestRun,
  sanitizeMongoSnapshotValue,
  snapshotMongoUpdate,
} from '../../adapters/mongo/update-snapshots/mongoUpdateSnapshot';
import { createMongoImportTarget } from '../../engine/import-targets/mongo/mongoImportTarget';

const matches = (doc: Document, filter: Document): boolean =>
  Object.entries(filter).every(([key, expected]) => {
    if (expected && typeof expected === 'object' && '$ne' in expected) {
      return doc[key] !== (expected as Document).$ne;
    }
    return doc[key] === expected;
  });

class FakeCollection {
  docs: Document[];
  replaceOrder: string[];

  constructor(docs: Document[] = [], replaceOrder: string[] = []) {
    this.docs = docs;
    this.replaceOrder = replaceOrder;
  }

  async findOne(filter: Document) {
    return this.docs.find((doc) => matches(doc, filter)) ?? null;
  }

  async insertOne(doc: Document) {
    const inserted = { _id: doc._id ?? `id-${this.docs.length + 1}`, ...doc };
    this.docs.push(inserted);
    return { insertedId: inserted._id };
  }

  async updateOne(filter: Document, update: Document) {
    const found = this.docs.find((doc) => matches(doc, filter));
    if (!found) return { matchedCount: 0 };
    Object.assign(found, update.$set ?? {});
    return { matchedCount: 1 };
  }

  async findOneAndUpdate(filter: Document, update: Document) {
    let found = this.docs.find((doc) => matches(doc, filter));
    if (!found) {
      found = { _id: `id-${this.docs.length + 1}` };
      this.docs.push(found);
    }
    Object.assign(found, update.$set ?? {}, update.$setOnInsert ?? {});
    return found;
  }

  async replaceOne(filter: Document, replacement: Document) {
    const index = this.docs.findIndex((doc) => matches(doc, filter));
    if (index < 0) return { matchedCount: 0 };
    this.replaceOrder.push(String(this.docs[index]._id ?? this.docs[index].id));
    this.docs[index] = { ...replacement };
    return { matchedCount: 1 };
  }

  find(filter: Document) {
    const rows = this.docs.filter((doc) => matches(doc, filter));
    return {
      sort: (sortSpec: Document) => ({
        toArray: async () => [...rows].sort((a, b) => {
          for (const [field, direction] of Object.entries(sortSpec)) {
            const av = a[field] instanceof Date ? a[field].getTime() : a[field];
            const bv = b[field] instanceof Date ? b[field].getTime() : b[field];
            if (av === bv) continue;
            return direction === -1 ? (av > bv ? -1 : 1) : (av > bv ? 1 : -1);
          }
          return 0;
        }),
      }),
    };
  }

  async countDocuments(filter: Document) {
    return this.docs.filter((doc) => matches(doc, filter)).length;
  }
}

const fakeDb = (collections: Record<string, FakeCollection>) => ({
  collection: (name: string) => {
    collections[name] ??= new FakeCollection();
    return collections[name];
  },
});

describe('mongo update snapshots', () => {
  it('requires testRunId', () => {
    expect(() => requireSnapshotTestRunId('')).toThrow('testRunId obrigatorio');
  });

  it('masks sensitive fields recursively', () => {
    const sanitized = sanitizeMongoSnapshotValue({
      access_token: 'secret',
      nested: { refresh_token: 'refresh', ok: 'value' },
      headers: { authorization: 'Bearer secret' },
    }) as Document;

    expect(sanitized.access_token).toBe('[hidden]');
    expect((sanitized.nested as Document).refresh_token).toBe('[hidden]');
    expect((sanitized.headers as Document).authorization).toBe('[hidden]');
    expect((sanitized.nested as Document).ok).toBe('value');
  });

  it('builds snapshot with before and patch sanitized', () => {
    const snapshot = buildMongoUpdateSnapshotDocument({
      collection: 'inventory_items',
      documentId: 'item-1',
      filter: { id: 'item-1' },
      before: { id: 'item-1', token: 'secret' },
      patch: { $set: { password: 'secret' } },
      context: { testRunId: 'run-1', runId: 'import-run-1' },
    });

    expect(snapshot.before.token).toBe('[hidden]');
    expect(snapshot.patch.$set.password).toBe('[hidden]');
    expect(snapshot.rolled_back).toBe(false);
  });

  it('creates snapshot before applying update', async () => {
    const collections = {
      inventory_items: new FakeCollection([{ _id: 'item-1', id: 'item-1', price: 10 }]),
      mongo_import_update_snapshots: new FakeCollection(),
    };
    const db = fakeDb(collections) as any;

    await snapshotMongoUpdate(
      db,
      {
        collection: 'inventory_items',
        filter: { id: 'item-1' },
        patch: { $set: { price: 20 } },
        context: { testRunId: 'run-1' },
      },
      async () => {
        expect(collections.mongo_import_update_snapshots.docs).toHaveLength(1);
        collections.inventory_items.docs[0].price = 20;
      }
    );

    expect(collections.mongo_import_update_snapshots.docs[0].before.price).toBe(10);
    expect(collections.mongo_import_update_snapshots.docs[0].after.price).toBe(20);
    expect(collections.mongo_import_update_snapshots.docs[0].update_applied).toBe(true);
  });

  it('does not create snapshot for insert', async () => {
    const collections = {
      inventory_items: new FakeCollection(),
      mongo_import_update_snapshots: new FakeCollection(),
    };
    const target = createMongoImportTarget(fakeDb(collections) as any);

    await target.createInventoryItem({
      store_id: 'store-1',
      code: 'P1',
      metadata: { testRunId: 'run-1' },
    });

    expect(collections.mongo_import_update_snapshots.docs).toHaveLength(0);
  });

  it('rolls back snapshots newest first and marks them as rolled_back', async () => {
    const replaceOrder: string[] = [];
    const collections = {
      inventory_items: new FakeCollection([
        { _id: 'item-1', id: 'item-1', price: 30 },
        { _id: 'item-2', id: 'item-2', price: 40 },
      ], replaceOrder),
      mongo_import_update_snapshots: new FakeCollection([
        {
          _id: 'snap-old',
          source: 'mongo_update_snapshot',
          testRunId: 'run-1',
          collection: 'inventory_items',
          documentId: 'item-1',
          before: { _id: 'item-1', id: 'item-1', price: 10 },
          created_at: new Date('2026-01-01T00:00:00Z'),
          rolled_back: false,
        },
        {
          _id: 'snap-new',
          source: 'mongo_update_snapshot',
          testRunId: 'run-1',
          collection: 'inventory_items',
          documentId: 'item-2',
          before: { _id: 'item-2', id: 'item-2', price: 20 },
          created_at: new Date('2026-01-02T00:00:00Z'),
          rolled_back: false,
        },
      ]),
    };

    const report = await rollbackMongoTestRun(fakeDb(collections) as any, 'run-1');

    expect(report.restored).toBe(2);
    expect(replaceOrder).toEqual(['item-2', 'item-1']);
    expect(collections.inventory_items.docs.find((doc) => doc.id === 'item-1')?.price).toBe(10);
    expect(collections.mongo_import_update_snapshots.docs.every((doc) => doc.rolled_back)).toBe(true);
  });

  it('does not alter documents without snapshot', async () => {
    const collections = {
      inventory_items: new FakeCollection([{ _id: 'item-1', id: 'item-1', price: 30 }]),
      mongo_import_update_snapshots: new FakeCollection(),
    };

    const report = await rollbackMongoTestRun(fakeDb(collections) as any, 'run-1');

    expect(report.matchedSnapshots).toBe(0);
    expect(collections.inventory_items.docs[0].price).toBe(30);
  });

  it('counts pending snapshots for cleanup warning', async () => {
    const collections = {
      [MONGO_COLLECTIONS.mongoImportUpdateSnapshots]: new FakeCollection([
        { source: 'mongo_update_snapshot', testRunId: 'run-1', rolled_back: false },
      ]),
    };

    await expect(countPendingMongoUpdateSnapshots(fakeDb(collections) as any, '')).rejects.toThrow();
    await expect(countPendingMongoUpdateSnapshots(fakeDb(collections) as any, 'run-1')).resolves.toBe(1);
  });
});

