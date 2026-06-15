import type { ImportRun } from './importHistory.types';

export type ReviewItemType =
  | 'possible_duplicate'
  | 'ad_pending'
  | 'ad_no_access'
  | 'ad_not_found'
  | 'ad_conflict'
  | 'no_image'
  | 'invalid_row'
  | 'failed_row'
  | 'warning';

export type ReviewItemStatus =
  | 'pending'
  | 'reviewed'
  | 'ignored'
  | 'resolved';

export type ReviewItemSeverity = 'info' | 'warning' | 'error';

export interface ReviewItem {
  id: string;
  runId: string;
  row: number;
  type: ReviewItemType;
  status: ReviewItemStatus;
  severity: ReviewItemSeverity;
  title: string;
  message: string;
  code?: string | null;
  idInt?: number | string | null;
  mlbId?: string | null;
  pecaId?: string | null;
  targetId?: string | null;
  payload?: unknown;
  rawItem?: unknown;
  createdAt?: string | null;
}

export interface ReviewSummary {
  total: number;
  pending: number;
  warnings: number;
  errors: number;
  byType: Record<string, number>;
}

export interface ReviewRun {
  run: ImportRun;
  summary: ReviewSummary;
}

export interface ReviewFilters {
  runId?: string;
  storeId?: string;
  fileName?: string;
  type?: ReviewItemType | '';
  dateFrom?: string;
  dateTo?: string;
}

export interface ReviewRunsResult {
  runs: ReviewRun[];
  totalRuns: number;
  summary: ReviewSummary;
}

export interface ReviewAdapter {
  listReviewRuns(filters?: ReviewFilters): Promise<ReviewRunsResult>;
  getReviewRun(runId: string): Promise<ImportRun | null>;
  getReviewItems(runId: string): Promise<{
    summary: ReviewSummary;
    items: ReviewItem[];
  }>;
}
