import { describe, expect, it } from 'vitest';
import { normalizeComparableValue } from '../../engine/import-targets/compare/normalizeImportPlanForComparison';
import { compareImportTargetPlans, getComparisonExitCode } from '../../engine/import-targets/compare/compareImportTargetPlans';
import type { ComparableImportPlan } from '../../engine/import-targets/compare/types';

const plan = (
  target: 'supabase' | 'mongo',
  row: Partial<ComparableImportPlan['rows'][number]>
): ComparableImportPlan => ({
  target,
  summary: {
    totalRows: 1,
    creates: row.action === 'create' ? 1 : 0,
    updates: row.action === 'update' ? 1 : 0,
    skipped: 0,
    conflicts: 0,
    invalid: 0,
    warnings: row.warnings?.length ?? 0,
  },
  rows: [{
    row: 1,
    code: 'ABC',
    id_int: 123,
    id_string: null,
    mlb_ids: ['MLB1'],
    action: 'create',
    matchedBy: null,
    matchedId: null,
    confidence: null,
    reason: null,
    payload: {
      store_id: 'store-1',
      code: 'ABC',
      id_int: 123,
      price: 10,
      stock_quantity: 1,
      status: 'DISPONIVEL',
    },
    warnings: [],
    ...row,
  }],
});

const compare = (
  supabaseRow: Partial<ComparableImportPlan['rows'][number]>,
  mongoRow: Partial<ComparableImportPlan['rows'][number]>
) => compareImportTargetPlans({
  file: 'file.csv',
  integrationId: 'int-1',
  storeId: 'store-1',
  supabase: plan('supabase', supabaseRow),
  mongo: plan('mongo', mongoRow),
  createdAt: '2026-01-01T00:00:00Z',
});

describe('normalizeComparableValue', () => {
  it('removes ids, timestamps and volatile metadata', () => {
    expect(normalizeComparableValue({
      _id: 'mongo-id',
      id: 'supabase-id',
      created_at: 'x',
      updated_at: 'y',
      metadata: { testRunId: 'run' },
      code: 'ABC',
    })).toEqual({ code: 'ABC' });
  });

  it('normalizes undefined as null', () => {
    expect(normalizeComparableValue(undefined)).toBeNull();
  });
});

describe('compareImportTargetPlans', () => {
  it('does not treat id vs _id as critical after normalization', () => {
    const report = compare(
      { payload: { code: 'ABC', id: 'supabase-id' } },
      { payload: { code: 'ABC', _id: 'mongo-id' } }
    );
    expect(report.summary.critical).toBe(0);
  });

  it('classifies price difference as critical', () => {
    const report = compare(
      { payload: { price: 10 } },
      { payload: { price: 20 } }
    );
    expect(report.summary.critical).toBe(1);
    expect(getComparisonExitCode(report)).toBe(1);
  });

  it('classifies quantity difference as critical', () => {
    const report = compare(
      { payload: { stock_quantity: 1 } },
      { payload: { stock_quantity: 2 } }
    );
    expect(report.rows[0].diffs[0].severity).toBe('critical');
  });

  it('classifies create vs update as critical', () => {
    const report = compare(
      { action: 'update', matchedBy: 'code' },
      { action: 'create', matchedBy: null }
    );
    expect(report.summary.critical).toBeGreaterThan(0);
  });

  it('classifies category gap as expected', () => {
    const report = compare(
      { payload: { part_category_name: 'Farol' } },
      { payload: { part_category_name: null }, warnings: ['category_pending:MLB1'] }
    );
    expect(report.summary.expected).toBeGreaterThan(0);
    expect(getComparisonExitCode(report)).toBe(0);
  });

  it('classifies different storage ids with same name as expected', () => {
    const report = compare(
      { payload: { storage_location_id: 'supabase-id', storage_location_name: 'A1' } },
      { payload: { storage_location_id: 'mongo-id', storage_location_name: 'A1' } }
    );
    expect(report.rows[0].diffs[0].severity).toBe('expected');
  });

  it('classifies warning differences as warning', () => {
    const report = compare(
      { warnings: ['ad_no_access:MLB1'] },
      { warnings: [] }
    );
    expect(report.summary.warning).toBe(1);
  });

  it('emits expected JSON report shape', () => {
    const report = compare({}, {});
    expect(report).toMatchObject({
      file: 'file.csv',
      integrationId: 'int-1',
      storeId: 'store-1',
      targets: ['supabase', 'mongo'],
      summary: { totalRows: 1 },
      rows: [{ row: 1, supabaseAction: 'create', mongoAction: 'create' }],
    });
  });
});
