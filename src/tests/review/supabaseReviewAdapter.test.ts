import { describe, expect, it, vi } from 'vitest';

vi.mock('../../adapters/supabase/supabaseImportHistoryAdapter', () => ({
  supabaseImportHistoryAdapter: {},
}));

import { createSupabaseReviewAdapter } from '../../adapters/supabase/supabaseReviewAdapter';
import type {
  ImportHistoryAdapter,
  ImportRun,
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
  totalRows: 5,
  validRows: 4,
  creates: 1,
  updates: 1,
  skipped: 1,
  conflicts: 1,
  invalid: 1,
  warningsCount: 0,
  failed: 1,
  summary: {
    complements: {
      pendingAds: 2,
      failedAds: 1,
      noImage: 3,
    },
  },
  metadata: {},
};

const historyAdapter = (): ImportHistoryAdapter => ({
  createRun: vi.fn(),
  saveRunItems: vi.fn(),
  completeRun: vi.fn(),
  failRun: vi.fn(),
  listRuns: vi.fn().mockResolvedValue({
    runs: [run],
    total: 1,
    page: 1,
    pageSize: 50,
    stats: {
      totalRuns: 1,
      totalCreates: 1,
      totalUpdates: 1,
      totalSkipped: 1,
      totalConflicts: 1,
      totalInvalid: 1,
      totalFailed: 1,
    },
  }),
  getRun: vi.fn(),
  getRunItems: vi.fn(),
  exportPending: vi.fn(),
});

describe('supabaseReviewAdapter listReviewRuns', () => {
  it('carrega somente import_runs e deriva contadores do summary', async () => {
    const history = historyAdapter();
    const adapter = createSupabaseReviewAdapter(history);

    const result = await adapter.listReviewRuns();

    expect(history.listRuns).toHaveBeenCalledOnce();
    expect(history.getRunItems).not.toHaveBeenCalled();
    expect(result.runs[0].summary.byType).toMatchObject({
      possible_duplicate: 1,
      invalid_row: 1,
      failed_row: 1,
      ad_pending: 3,
      no_image: 3,
    });
  });
});
