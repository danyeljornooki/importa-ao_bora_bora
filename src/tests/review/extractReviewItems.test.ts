import { describe, expect, it } from 'vitest';
import { extractReviewItems } from '../../core/review/extractReviewItems';
import type {
  ImportRun,
  ImportRunItem,
} from '../../types/importHistory.types';

const run: ImportRun = {
  id: 'run-1',
  storeId: 'store-1',
  status: 'completed',
  adapter: 'supabase',
  engineVersion: '1.1.0',
  fileName: 'pecas.xlsx',
  sheetName: 'Pecas',
  createdAt: '2026-06-15T12:00:00.000Z',
  finishedAt: '2026-06-15T12:01:00.000Z',
  durationMs: 60000,
  totalRows: 1,
  validRows: 1,
  creates: 0,
  updates: 0,
  skipped: 0,
  conflicts: 0,
  invalid: 0,
  warningsCount: 0,
  failed: 0,
  summary: {},
  metadata: {},
};

const item = (
  overrides: Partial<ImportRunItem> = {}
): ImportRunItem => ({
  id: 'item-1',
  runId: run.id,
  row: 1,
  action: 'create',
  matchedBy: null,
  confidence: null,
  targetId: 'part-1',
  reason: null,
  payload: {
    code: 'P-1',
    id_int: 10,
    partResult: { action: 'created', pecaId: 'part-1' },
    adLinkResult: { action: 'skipped' },
    imagePlan: { action: 'used_sheet', source: 'sheet' },
  },
  changes: [],
  warnings: [],
  errors: [],
  executionStatus: 'success',
  executionError: null,
  executionResult: null,
  createdAt: '2026-06-15T12:00:01.000Z',
  ...overrides,
});

const extractedTypes = (items: ImportRunItem[]) =>
  extractReviewItems({ run, items }).items.map((reviewItem) => reviewItem.type);

describe('extractReviewItems', () => {
  it('converte conflict em possible_duplicate', () => {
    expect(extractedTypes([item({
      action: 'conflict',
      reason: 'possível peça duplicada',
    })])).toContain('possible_duplicate');
  });

  it('converte AdLink HTTP 403 em ad_no_access', () => {
    expect(extractedTypes([item({
      payload: {
        adLinkResult: {
          action: 'pending',
          reason: 'sem acesso ao anúncio pelo token da integração',
          error: 'HTTP 403',
        },
        imagePlan: { action: 'used_sheet', source: 'sheet' },
      },
    })])).toContain('ad_no_access');
  });

  it('converte AdLink HTTP 404 em ad_not_found', () => {
    expect(extractedTypes([item({
      payload: {
        adLinkResult: {
          action: 'pending',
          reason: 'anúncio não encontrado/removido',
          error: 'HTTP 404',
        },
        imagePlan: { action: 'used_sheet', source: 'sheet' },
      },
    })])).toContain('ad_not_found');
  });

  it('converte imagePlan no_image em no_image', () => {
    expect(extractedTypes([item({
      payload: {
        adLinkResult: { action: 'skipped' },
        imagePlan: { action: 'no_image', source: 'none' },
      },
    })])).toContain('no_image');
  });

  it('converte falha de execucao em failed_row', () => {
    expect(extractedTypes([item({
      executionStatus: 'failed',
      executionError: 'Create failed',
    })])).toContain('failed_row');
  });

  it('converte invalid em invalid_row', () => {
    expect(extractedTypes([item({
      action: 'invalid',
      reason: 'price obrigatório',
    })])).toContain('invalid_row');
  });

  it('contabiliza summary por tipo', () => {
    const result = extractReviewItems({
      run,
      items: [
        item({
          id: 'duplicate',
          action: 'conflict',
          reason: 'possível peça duplicada',
        }),
        item({
          id: 'image',
          row: 2,
          payload: {
            adLinkResult: { action: 'skipped' },
            imagePlan: { action: 'no_image', source: 'none' },
          },
        }),
        item({
          id: 'failed',
          row: 3,
          executionStatus: 'failed',
        }),
      ],
    });

    expect(result.summary.total).toBe(3);
    expect(result.summary.byType).toMatchObject({
      possible_duplicate: 1,
      no_image: 1,
      failed_row: 1,
    });
    expect(result.summary.errors).toBe(1);
    expect(result.summary.warnings).toBe(1);
  });
});
