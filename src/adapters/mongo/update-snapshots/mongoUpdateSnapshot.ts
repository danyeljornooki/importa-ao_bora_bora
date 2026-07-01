import { ObjectId, type Db, type Document, type Filter } from 'mongodb';
import { MONGO_COLLECTIONS } from '../client/collectionNames';

export const MONGO_UPDATE_SNAPSHOT_SOURCE = 'mongo_update_snapshot';

const SENSITIVE_KEYS = new Set([
  'access_token',
  'refresh_token',
  'token',
  'authorization',
  'password',
  'client_secret',
]);

export interface MongoUpdateSnapshotContext {
  testRunId?: string | null;
  runId?: string | null;
  integrationId?: string | null;
  storeId?: string | null;
  fileName?: string | null;
}

export interface MongoUpdateSnapshotInput {
  collection: string;
  documentId: string;
  filter: Filter<Document>;
  before: Document;
  patch: Document;
  after?: Document | null;
  context: MongoUpdateSnapshotContext;
  updateApplied?: boolean;
  updateError?: string | null;
}

export interface MongoRollbackReport {
  testRunId: string;
  matchedSnapshots: number;
  restored: number;
  skipped: number;
  failed: number;
  errors: Array<{ snapshotId: string; collection: string; documentId: string; error: string }>;
}

const hasText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

const isSensitiveKey = (key: string): boolean => {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYS.has(normalized) || normalized.includes('token');
};

export const sanitizeMongoSnapshotValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sanitizeMongoSnapshotValue);
  }

  if (value instanceof Date || value instanceof ObjectId) {
    return value;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        isSensitiveKey(key) ? '[hidden]' : sanitizeMongoSnapshotValue(item),
      ])
    );
  }

  return value;
};

export const requireSnapshotTestRunId = (testRunId: unknown): string => {
  if (!hasText(testRunId)) {
    throw new Error('testRunId obrigatorio para snapshot/rollback Mongo.');
  }
  return testRunId.trim();
};

const snapshotIdFilter = (id: unknown): Filter<Document> => {
  const text = String(id ?? '');
  return ObjectId.isValid(text) ? { _id: new ObjectId(text) } : { _id: id };
};

const documentIdFilter = (documentId: string): Filter<Document> =>
  ObjectId.isValid(documentId) ? { _id: new ObjectId(documentId) } : { id: documentId };

export const buildMongoUpdateSnapshotDocument = (
  input: MongoUpdateSnapshotInput,
  now: Date = new Date()
): Document => {
  const testRunId = requireSnapshotTestRunId(input.context.testRunId);

  return {
    testRunId,
    runId: input.context.runId ?? null,
    target: 'mongo',
    source: MONGO_UPDATE_SNAPSHOT_SOURCE,
    collection: input.collection,
    documentId: input.documentId,
    store_id: input.context.storeId ?? input.before.store_id ?? null,
    integration_id: input.context.integrationId ?? input.before.integration_id ?? null,
    file_name: input.context.fileName ?? null,
    operation: 'update',
    filter: sanitizeMongoSnapshotValue(input.filter),
    before: sanitizeMongoSnapshotValue(input.before),
    patch: sanitizeMongoSnapshotValue(input.patch),
    after: input.after ? sanitizeMongoSnapshotValue(input.after) : null,
    update_applied: input.updateApplied ?? false,
    update_error: input.updateError ?? null,
    created_at: now,
    rolled_back: false,
    rolled_back_at: null,
    rollback_error: null,
    metadata: {
      source: MONGO_UPDATE_SNAPSHOT_SOURCE,
      target: 'mongo',
      testRunId,
      runId: input.context.runId ?? undefined,
    },
  };
};

export const createMongoUpdateSnapshot = async (
  db: Db,
  input: MongoUpdateSnapshotInput
): Promise<string> => {
  const result = await db.collection(MONGO_COLLECTIONS.mongoImportUpdateSnapshots)
    .insertOne(buildMongoUpdateSnapshotDocument(input));
  return String(result.insertedId);
};

export const updateMongoSnapshotAfter = async (
  db: Db,
  snapshotId: string,
  after: Document | null,
  patch: Partial<Document> = {}
): Promise<void> => {
  await db.collection(MONGO_COLLECTIONS.mongoImportUpdateSnapshots).updateOne(
    snapshotIdFilter(snapshotId),
    {
      $set: {
        after: after ? sanitizeMongoSnapshotValue(after) : null,
        ...patch,
      },
    }
  );
};

export const snapshotMongoUpdate = async (
  db: Db,
  input: {
    collection: string;
    filter: Filter<Document>;
    patch: Document;
    context: MongoUpdateSnapshotContext;
  },
  update: () => Promise<void>
): Promise<{ snapshotId: string | null; before: Document | null; after: Document | null }> => {
  const before = await db.collection(input.collection).findOne(input.filter);
  if (!before) {
    await update();
    return { snapshotId: null, before: null, after: null };
  }

  const documentId = String(before.id ?? before._id);
  const snapshotId = await createMongoUpdateSnapshot(db, {
    collection: input.collection,
    documentId,
    filter: input.filter,
    before,
    patch: input.patch,
    context: input.context,
    updateApplied: false,
  });

  try {
    await update();
    const after = await db.collection(input.collection).findOne(input.filter);
    await updateMongoSnapshotAfter(db, snapshotId, after, { update_applied: true });
    return { snapshotId, before, after };
  } catch (error) {
    await updateMongoSnapshotAfter(db, snapshotId, null, {
      update_applied: false,
      update_error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export const rollbackMongoTestRun = async (
  db: Db,
  testRunIdInput: string
): Promise<MongoRollbackReport> => {
  const testRunId = requireSnapshotTestRunId(testRunIdInput);
  const snapshots = await db.collection(MONGO_COLLECTIONS.mongoImportUpdateSnapshots)
    .find({
      source: MONGO_UPDATE_SNAPSHOT_SOURCE,
      testRunId,
      rolled_back: { $ne: true },
    })
    .sort({ created_at: -1, _id: -1 })
    .toArray();

  const report: MongoRollbackReport = {
    testRunId,
    matchedSnapshots: snapshots.length,
    restored: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const snapshot of snapshots) {
    const snapshotId = String(snapshot._id);
    const collection = hasText(snapshot.collection) ? snapshot.collection : '';
    const documentId = hasText(snapshot.documentId) ? snapshot.documentId : '';
    const before = snapshot.before;

    if (!collection || !documentId || !before || typeof before !== 'object' || Array.isArray(before)) {
      report.skipped += 1;
      continue;
    }

    try {
      await db.collection(collection).replaceOne(documentIdFilter(documentId), before as Document);
      await db.collection(MONGO_COLLECTIONS.mongoImportUpdateSnapshots).updateOne(
        { _id: snapshot._id },
        {
          $set: {
            rolled_back: true,
            rolled_back_at: new Date(),
            rollback_error: null,
          },
        }
      );
      report.restored += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.collection(MONGO_COLLECTIONS.mongoImportUpdateSnapshots).updateOne(
        { _id: snapshot._id },
        { $set: { rollback_error: message } }
      );
      report.failed += 1;
      report.errors.push({ snapshotId, collection, documentId, error: message });
    }
  }

  return report;
};

export const countPendingMongoUpdateSnapshots = async (
  db: Db,
  testRunIdInput: string
): Promise<number> => {
  const testRunId = requireSnapshotTestRunId(testRunIdInput);
  return db.collection(MONGO_COLLECTIONS.mongoImportUpdateSnapshots).countDocuments({
    source: MONGO_UPDATE_SNAPSHOT_SOURCE,
    testRunId,
    rolled_back: { $ne: true },
  });
};
