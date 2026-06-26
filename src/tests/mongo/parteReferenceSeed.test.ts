import { describe, expect, it } from 'vitest';
import {
  buildParteUpsertFilter,
  parseParteJson,
  seedParteDocuments,
  validateParteDocument,
} from '../../adapters/mongo/parteReferenceSeed';

describe('parte reference seed', () => {
  it('parses a JSON array export', () => {
    const docs = parseParteJson(JSON.stringify([
      { MLB_categoria_id: 'MLB123', nome: 'Farol' },
      { _id: 'abc', nome: 'Parachoque' },
    ]));

    expect(docs).toHaveLength(2);
    expect(docs[0].MLB_categoria_id).toBe('MLB123');
  });

  it('parses a JSON object with documents[]', () => {
    const docs = parseParteJson(JSON.stringify({
      documents: [{ MLB_categoria_id: 'MLB456', nome: 'Grade' }],
    }));

    expect(docs).toEqual([{ MLB_categoria_id: 'MLB456', nome: 'Grade' }]);
  });

  it('validates that a document has MLB_categoria_id or _id', () => {
    expect(validateParteDocument({ MLB_categoria_id: 'MLB123' }).valid).toBe(true);
    expect(validateParteDocument({ _id: 'mongo-id' }).valid).toBe(true);
    expect(validateParteDocument({ nome: 'Sem chave' }).valid).toBe(false);
  });

  it('uses MLB_categoria_id as preferred upsert key', () => {
    expect(buildParteUpsertFilter({ _id: 'abc', MLB_categoria_id: 'MLB123' })).toEqual({
      MLB_categoria_id: 'MLB123',
    });
    expect(buildParteUpsertFilter({ _id: 'abc' })).toEqual({ _id: 'abc' });
  });

  it('builds seed report from upsert results', async () => {
    const calls: unknown[] = [];
    const collection = {
      async updateOne(...args: unknown[]) {
        calls.push(args);
        return calls.length === 1
          ? { upsertedCount: 1, matchedCount: 0 }
          : { upsertedCount: 0, matchedCount: 1 };
      },
    };

    const report = await seedParteDocuments(
      collection as never,
      [
        { MLB_categoria_id: 'MLB1', nome: 'A' },
        { _id: 'fallback-id', nome: 'B' },
        { nome: 'Sem chave' },
      ],
      { file: 'parte.json', seededAt: new Date('2026-01-01T00:00:00Z') }
    );

    expect(report.read).toBe(3);
    expect(report.valid).toBe(2);
    expect(report.inserted).toBe(1);
    expect(report.updated).toBe(1);
    expect(report.ignored).toBe(1);
    expect(report.withoutMlbCategoryId).toBe(2);
  });
});
