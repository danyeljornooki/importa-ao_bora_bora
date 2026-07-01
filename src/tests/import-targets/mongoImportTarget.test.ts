import { describe, expect, it } from 'vitest';
import {
  buildMongoImportMetadata,
  buildMongoImportRunItemDocument,
  buildMongoInventoryMatchFilters,
  buildMongoMarketplaceAdFilter,
  buildMongoStorageLocationFilter,
  MONGO_IMPORT_ADAPTER_SOURCE,
} from '../../engine/import-targets/mongo/mongoImportTarget';
import { evaluateMongoImportQualityGate } from '../../adapters/mongo/quality/mongoImportQualityGate';

describe('mongo import target query builders', () => {
  it('builds inventory match query by id_int first', () => {
    const filters = buildMongoInventoryMatchFilters({
      storeId: 'store-1',
      idInt: 123,
      code: 'ABC',
    });

    expect(filters[0]).toEqual({
      matchedBy: 'id_int',
      filter: { store_id: 'store-1', deleted: { $ne: true }, id_int: 123 },
    });
  });

  it('builds inventory match query by code', () => {
    const filters = buildMongoInventoryMatchFilters({
      storeId: 'store-1',
      code: 'ABC',
    });

    expect(filters).toContainEqual({
      matchedBy: 'code',
      filter: { store_id: 'store-1', deleted: { $ne: true }, code: 'ABC' },
    });
  });

  it('builds storage location query', () => {
    expect(buildMongoStorageLocationFilter({ storeId: 'store-1', name: 'PRATELEIRA' })).toEqual({
      store_id: 'store-1',
      name: 'PRATELEIRA',
      status: 'active',
    });
  });

  it('builds marketplace ad query by mlb_id or data.id', () => {
    expect(buildMongoMarketplaceAdFilter({ integrationId: 'int-1', mlbId: 'MLB123' })).toEqual({
      integration_id: 'int-1',
      $or: [{ mlb_id: 'MLB123' }, { 'data.id': 'MLB123' }],
    });
  });

  it('builds safe metadata without token fields', () => {
    const metadata = buildMongoImportMetadata({
      testRunId: 'run-1',
      integrationId: 'int-1',
      fileName: 'file.csv',
      importedAt: new Date('2026-01-01T00:00:00Z'),
    });

    expect(metadata).toEqual({
      source: MONGO_IMPORT_ADAPTER_SOURCE,
      testRunId: 'run-1',
      runId: undefined,
      integrationId: 'int-1',
      fileName: 'file.csv',
      importedAt: new Date('2026-01-01T00:00:00Z'),
    });
    expect(JSON.stringify(metadata)).not.toMatch(/token|password|secret/i);
  });

  it('builds import_run_items documents by row', () => {
    const metadata = buildMongoImportMetadata({
      testRunId: 'run-1',
      runId: 'mongo-run-id',
      integrationId: 'int-1',
      fileName: 'file.csv',
      importedAt: new Date('2026-01-01T00:00:00Z'),
    });
    const doc = buildMongoImportRunItemDocument({
      runId: 'mongo-run-id',
      testRunId: 'run-1',
      row: 7,
      status: 'create',
      type: 'create',
      action: 'create',
      code: 'ABC',
      idInt: 123,
      idString: null,
      mlbId: 'MLB123',
      pecaId: 'peca-1',
      warnings: ['category_pending'],
      errors: [],
      raw: { Codigo: 'ABC' },
      normalized: { code: 'ABC' },
      metadata,
    }, new Date('2026-01-02T00:00:00Z'));

    expect(doc).toMatchObject({
      run_id: 'mongo-run-id',
      testRunId: 'run-1',
      row: 7,
      status: 'create',
      action: 'create',
      code: 'ABC',
      id_int: 123,
      mlb_id: 'MLB123',
      peca_id: 'peca-1',
      warnings: ['category_pending'],
      raw: { Codigo: 'ABC' },
      normalized: { code: 'ABC' },
      metadata,
    });
  });
});

describe('mongo import quality gate', () => {
  const dryRun = {
    totalRows: 19,
    valid: 19,
    invalid: 0,
    categoriesFound: 0,
    categoriesMissing: 17,
  };

  it('does not block category_pending on dryRun', () => {
    expect(evaluateMongoImportQualityGate(dryRun, { write: false }).allowed).toBe(true);
  });

  it('blocks category_pending on write without allow flag', () => {
    const gate = evaluateMongoImportQualityGate(dryRun, { write: true });
    expect(gate.allowed).toBe(false);
    expect(gate.errors).toContain('Write bloqueado: collection parte sem cobertura suficiente.');
  });

  it('allows category_pending on write with explicit allow flag', () => {
    const gate = evaluateMongoImportQualityGate(dryRun, {
      write: true,
      allowCategoryPending: true,
    });
    expect(gate.allowed).toBe(true);
    expect(gate.warnings.join(' ')).toContain('--allow-category-pending');
  });

  it('blocks empty files for write', () => {
    const gate = evaluateMongoImportQualityGate({
      totalRows: 0,
      valid: 0,
      invalid: 0,
      categoriesFound: 0,
      categoriesMissing: 0,
    }, { write: true });
    expect(gate.allowed).toBe(false);
  });
});
