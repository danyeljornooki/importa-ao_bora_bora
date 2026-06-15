import {
  extractReviewItems,
  summarizeReviewItems,
} from '../../core/review/extractReviewItems';
import type {
  ImportHistoryAdapter,
  ImportRun,
  ImportRunFilters,
  ImportRunItem,
} from '../../types/importHistory.types';
import type {
  ReviewAdapter,
  ReviewFilters,
  ReviewItem,
  ReviewItemType,
  ReviewRun,
  ReviewRunsResult,
  ReviewSummary,
} from '../../types/review.types';
import { supabaseImportHistoryAdapter } from './supabaseImportHistoryAdapter';

const RUN_LIMIT = 50;
const ITEM_PAGE_SIZE = 100;

const historyFilters = (
  filters: ReviewFilters
): ImportRunFilters => ({
  runId: filters.runId,
  storeId: filters.storeId,
  fileName: filters.fileName,
  dateFrom: filters.dateFrom,
  dateTo: filters.dateTo,
});

const loadAllRunItems = async (
  historyAdapter: ImportHistoryAdapter,
  runId: string
): Promise<ImportRunItem[]> => {
  const items: ImportRunItem[] = [];

  for (let page = 1; ; page += 1) {
    const result = await historyAdapter.getRunItems(runId, {
      page,
      pageSize: ITEM_PAGE_SIZE,
    });
    items.push(...result.items);
    if (items.length >= result.total || result.items.length === 0) break;
  }

  return items;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const asNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const nestedNumber = (
  value: unknown,
  path: string[]
): number => {
  let current = value;
  for (const field of path) {
    current = asRecord(current)[field];
  }
  return asNumber(current);
};

const runReviewSummary = (run: ImportRun): ReviewSummary => {
  const summary = asRecord(run.summary);
  const complementSummary = asRecord(summary.complements);
  const commitSummary = asRecord(summary.commit);
  const pendingAds =
    asNumber(complementSummary.pendingAds) ||
    nestedNumber(commitSummary, ['pendingAds']);
  const failedAds =
    asNumber(complementSummary.failedAds) ||
    nestedNumber(commitSummary, ['failedAds']);
  const byType: Record<string, number> = {
    possible_duplicate: run.conflicts,
    invalid_row: run.invalid,
    failed_row: run.failed,
    ad_pending: pendingAds + failedAds,
    no_image:
      asNumber(complementSummary.noImage) ||
      nestedNumber(commitSummary, ['noImage']),
  };

  const total = Object.values(byType).reduce(
    (sum, value) => sum + value,
    0
  );

  return {
    total,
    pending: total,
    warnings:
      byType.possible_duplicate +
      byType.ad_pending,
    errors:
      byType.invalid_row +
      byType.failed_row,
    byType,
  };
};

const matchesType = (
  summary: ReviewSummary,
  type: ReviewItemType | '' | undefined
): boolean => !type || (summary.byType[type] ?? 0) > 0;

const aggregateRunSummaries = (runs: ReviewRun[]): ReviewSummary => {
  const byType: Record<string, number> = {};
  let total = 0;
  let pending = 0;
  let warnings = 0;
  let errors = 0;

  for (const reviewed of runs) {
    total += reviewed.summary.total;
    pending += reviewed.summary.pending;
    warnings += reviewed.summary.warnings;
    errors += reviewed.summary.errors;
    for (const [type, count] of Object.entries(reviewed.summary.byType)) {
      byType[type] = (byType[type] ?? 0) + count;
    }
  }

  return { total, pending, warnings, errors, byType };
};

const reviewForRun = async (
  historyAdapter: ImportHistoryAdapter,
  run: ImportRun,
  typeFilter?: ReviewFilters['type']
): Promise<{ run: ReviewRun; items: ReviewItem[] }> => {
  const historyItems = await loadAllRunItems(historyAdapter, run.id);
  const extracted = extractReviewItems({ run, items: historyItems });
  const items = typeFilter
    ? extracted.items.filter((item) => item.type === typeFilter)
    : extracted.items;

  return {
    run: {
      run,
      summary: summarizeReviewItems(items),
    },
    items,
  };
};

export const createSupabaseReviewAdapter = (
  historyAdapter: ImportHistoryAdapter = supabaseImportHistoryAdapter
): ReviewAdapter => ({
  async listReviewRuns(
    filters: ReviewFilters = {}
  ): Promise<ReviewRunsResult> {
    const historyResult = await historyAdapter.listRuns({
      page: 1,
      pageSize: RUN_LIMIT,
      filters: historyFilters(filters),
    });

    const reviewedRuns = historyResult.runs
      .map((run): ReviewRun => ({
        run,
        summary: runReviewSummary(run),
      }))
      .filter(({ summary }) =>
        summary.total > 0 && matchesType(summary, filters.type)
      );

    return {
      runs: reviewedRuns,
      totalRuns: reviewedRuns.length,
      summary: aggregateRunSummaries(reviewedRuns),
    };
  },

  getReviewRun(runId: string) {
    return historyAdapter.getRun(runId);
  },

  async getReviewItems(runId: string) {
    const run = await historyAdapter.getRun(runId);
    if (!run) {
      return {
        summary: summarizeReviewItems([]),
        items: [],
      };
    }

    const reviewed = await reviewForRun(historyAdapter, run);
    return {
      summary: reviewed.run.summary,
      items: reviewed.items,
    };
  },
});

export const supabaseReviewAdapter: ReviewAdapter =
  createSupabaseReviewAdapter();
