export type ImportHistoryAction =
  | 'create'
  | 'update'
  | 'skip'
  | 'conflict'
  | 'invalid';

export type ImportHistoryExecutionStatus =
  | 'pending'
  | 'success'
  | 'failed'
  | 'skipped';

export interface CreateImportRunInput {
  storeId: string;
  adapter: string;
  engineVersion: string;
  fileName?: string | null;
  sheetName?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateImportRunResult {
  id: string;
}

export interface SaveImportRunItemInput {
  row: number;
  action: ImportHistoryAction;
  matchedBy?: string | null;
  confidence?: number | null;
  targetId?: string | null;
  reason?: string | null;
  payload?: unknown;
  changes?: unknown[];
  warnings?: string[] | unknown[];
  errors?: string[] | unknown[];
  executionStatus?: ImportHistoryExecutionStatus;
  executionError?: string | null;
}

export interface CompleteImportRunInput {
  totalRows: number;
  validRows: number;
  creates: number;
  updates: number;
  skipped: number;
  conflicts: number;
  invalid: number;
  warningsCount: number;
  failed: number;
  durationMs?: number | null;
  summary?: Record<string, unknown>;
}

export interface FailImportRunInput {
  error: string;
  summary?: Record<string, unknown>;
}

export type ImportRunStatus = 'running' | 'completed' | 'failed' | string;

export interface ImportRun {
  id: string;
  storeId: string;
  status: ImportRunStatus;
  adapter: string;
  engineVersion: string;
  fileName: string | null;
  sheetName: string | null;
  createdAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  totalRows: number;
  validRows: number;
  creates: number;
  updates: number;
  skipped: number;
  conflicts: number;
  invalid: number;
  warningsCount: number;
  failed: number;
  summary: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface ImportRunItem {
  id: string;
  runId: string;
  row: number;
  action: ImportHistoryAction;
  matchedBy: string | null;
  confidence: number | null;
  targetId: string | null;
  reason: string | null;
  payload: unknown;
  changes: unknown[];
  warnings: unknown[];
  errors: unknown[];
  executionStatus: ImportHistoryExecutionStatus;
  executionError: string | null;
  executionResult: unknown;
  createdAt: string | null;
}

export interface ImportRunFilters {
  storeId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  fileName?: string;
  runId?: string;
  search?: string;
}

export interface ImportRunStats {
  totalRuns: number;
  totalCreates: number;
  totalUpdates: number;
  totalSkipped: number;
  totalConflicts: number;
  totalInvalid: number;
  totalFailed: number;
}

export interface ListImportRunsInput {
  page?: number;
  pageSize?: number;
  filters?: ImportRunFilters;
}

export interface ListImportRunsResult {
  runs: ImportRun[];
  total: number;
  page: number;
  pageSize: number;
  stats: ImportRunStats;
}

export interface GetImportRunItemsInput {
  action?: ImportHistoryAction;
  executionStatus?: ImportHistoryExecutionStatus;
  page?: number;
  pageSize?: number;
}

export interface GetImportRunItemsResult {
  items: ImportRunItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ImportHistoryAdapter {
  createRun(input: CreateImportRunInput): Promise<CreateImportRunResult>;
  saveRunItems(runId: string, items: SaveImportRunItemInput[]): Promise<void>;
  completeRun(runId: string, input: CompleteImportRunInput): Promise<void>;
  failRun(runId: string, input: FailImportRunInput): Promise<void>;
  listRuns(input?: ListImportRunsInput): Promise<ListImportRunsResult>;
  getRun(runId: string): Promise<ImportRun | null>;
  getRunItems(
    runId: string,
    input?: GetImportRunItemsInput
  ): Promise<GetImportRunItemsResult>;
  exportPending(runId: string): Promise<string>;
}
