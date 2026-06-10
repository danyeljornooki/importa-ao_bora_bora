import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from './supabaseClient';
import type {
  CompleteImportRunInput,
  CreateImportRunInput,
  CreateImportRunResult,
  FailImportRunInput,
  GetImportRunItemsInput,
  GetImportRunItemsResult,
  ImportHistoryAdapter,
  ImportRun,
  ImportRunItem,
  ImportRunStats,
  ListImportRunsInput,
  ListImportRunsResult,
  SaveImportRunItemInput,
} from '../../types/importHistory.types';

const SAVE_ITEMS_BATCH_SIZE = 500;
const RUNS_PAGE_SIZE = 50;
const ITEMS_PAGE_SIZE = 50;
const STATS_BATCH_SIZE = 1000;

export interface SupabaseImportHistoryAdapterOptions {
  batchSize?: number;
}

const resolveBatchSize = (batchSize: number | undefined): number => {
  if (typeof batchSize !== 'number' || !Number.isFinite(batchSize) || batchSize < 1) {
    return SAVE_ITEMS_BATCH_SIZE;
  }

  return Math.floor(batchSize);
};

const requireId = (value: unknown): string => {
  if (value === null || value === undefined || String(value).trim() === '') {
    throw new Error('import_runs.id ausente após criação');
  }

  return String(value);
};

const mapRunItem = (runId: string, item: SaveImportRunItemInput) => ({
  run_id: runId,
  row_number: item.row,
  action: item.action,
  matched_by: item.matchedBy ?? null,
  confidence: item.confidence ?? null,
  target_id: item.targetId ?? null,
  reason: item.reason ?? null,
  payload: item.payload ?? null,
  changes: item.changes ? [...item.changes] : [],
  warnings: item.warnings ? [...item.warnings] : [],
  errors: item.errors ? [...item.errors] : [],
  execution_status: item.executionStatus ?? 'pending',
  execution_error: item.executionError ?? null,
});

type SupabaseRow = Record<string, unknown>;

const asString = (value: unknown, fallback = ''): string =>
  value === null || value === undefined ? fallback : String(value);

const asNullableString = (value: unknown): string | null =>
  value === null || value === undefined || String(value).trim() === ''
    ? null
    : String(value);

const asNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const asNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? [...value] : [];

const mapImportRun = (row: SupabaseRow): ImportRun => ({
  id: asString(row.id),
  storeId: asString(row.store_id),
  status: asString(row.status),
  adapter: asString(row.adapter),
  engineVersion: asString(row.engine_version),
  fileName: asNullableString(row.file_name),
  sheetName: asNullableString(row.sheet_name),
  createdAt: asString(row.created_at),
  finishedAt: asNullableString(row.finished_at),
  durationMs: asNullableNumber(row.duration_ms),
  totalRows: asNumber(row.total_rows),
  validRows: asNumber(row.valid_rows),
  creates: asNumber(row.creates),
  updates: asNumber(row.updates),
  skipped: asNumber(row.skipped),
  conflicts: asNumber(row.conflicts),
  invalid: asNumber(row.invalid),
  warningsCount: asNumber(row.warnings_count),
  failed: asNumber(row.failed),
  summary: asRecord(row.summary),
  metadata: asRecord(row.metadata),
});

const mapImportRunItem = (row: SupabaseRow): ImportRunItem => ({
  id: asString(row.id),
  runId: asString(row.run_id),
  row: asNumber(row.row_number),
  action: asString(row.action) as ImportRunItem['action'],
  matchedBy: asNullableString(row.matched_by),
  confidence: asNullableNumber(row.confidence),
  targetId: asNullableString(row.target_id),
  reason: asNullableString(row.reason),
  payload: row.payload ?? null,
  changes: asArray(row.changes),
  warnings: asArray(row.warnings),
  errors: asArray(row.errors),
  executionStatus: asString(row.execution_status, 'pending') as ImportRunItem['executionStatus'],
  executionError: asNullableString(row.execution_error),
  executionResult: row.execution_result ?? null,
  createdAt: asNullableString(row.created_at),
});

const clampPage = (page: number | undefined): number =>
  typeof page === 'number' && Number.isFinite(page) && page > 0
    ? Math.floor(page)
    : 1;

const clampPageSize = (
  pageSize: number | undefined,
  fallback: number
): number =>
  typeof pageSize === 'number' && Number.isFinite(pageSize) && pageSize > 0
    ? Math.min(100, Math.floor(pageSize))
    : fallback;

const csvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const getPayloadField = (payload: unknown, field: string): unknown => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  return (payload as Record<string, unknown>)[field] ?? null;
};

export const createSupabaseImportHistoryAdapter = (
  client: SupabaseClient = defaultSupabase,
  options: SupabaseImportHistoryAdapterOptions = {}
): ImportHistoryAdapter => {
  const batchSize = resolveBatchSize(options.batchSize);

  return {
    async createRun(
      input: CreateImportRunInput
    ): Promise<CreateImportRunResult> {
      const record = {
        store_id: input.storeId,
        adapter: input.adapter,
        engine_version: input.engineVersion,
        file_name: input.fileName ?? null,
        sheet_name: input.sheetName ?? null,
        status: 'running',
        metadata: input.metadata ? { ...input.metadata } : {},
      };

      const { data, error } = await client
        .from('import_runs')
        .insert(record)
        .select('id')
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const row = data as { id?: unknown } | null;
      return { id: requireId(row?.id) };
    },

    async saveRunItems(
      runId: string,
      items: SaveImportRunItemInput[]
    ): Promise<void> {
      for (let start = 0; start < items.length; start += batchSize) {
        const batch = items
          .slice(start, start + batchSize)
          .map((item) => mapRunItem(runId, item));

        const { error } = await client
          .from('import_run_items')
          .insert(batch);

        if (error) {
          throw new Error(error.message);
        }
      }
    },

    async completeRun(
      runId: string,
      input: CompleteImportRunInput
    ): Promise<void> {
      const record = {
        status: 'completed',
        finished_at: new Date().toISOString(),
        duration_ms: input.durationMs ?? null,
        total_rows: input.totalRows,
        valid_rows: input.validRows,
        creates: input.creates,
        updates: input.updates,
        skipped: input.skipped,
        conflicts: input.conflicts,
        invalid: input.invalid,
        warnings_count: input.warningsCount,
        failed: input.failed,
        summary: input.summary ? { ...input.summary } : {},
      };

      const { error } = await client
        .from('import_runs')
        .update(record)
        .eq('id', runId);

      if (error) {
        throw new Error(error.message);
      }
    },

    async failRun(
      runId: string,
      input: FailImportRunInput
    ): Promise<void> {
      const record = {
        status: 'failed',
        finished_at: new Date().toISOString(),
        metadata: { error: input.error },
        summary: input.summary ? { ...input.summary } : {},
      };

      const { error } = await client
        .from('import_runs')
        .update(record)
        .eq('id', runId);

      if (error) {
        throw new Error(error.message);
      }
    },

    async listRuns(
      input: ListImportRunsInput = {}
    ): Promise<ListImportRunsResult> {
      const page = clampPage(input.page);
      const pageSize = clampPageSize(input.pageSize, RUNS_PAGE_SIZE);
      const filters = input.filters ?? {};
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;
      let pageQuery = client
        .from('import_runs')
        .select('*', { count: 'exact' });

      if (filters.storeId?.trim()) pageQuery = pageQuery.eq('store_id', filters.storeId.trim());
      if (filters.status?.trim()) pageQuery = pageQuery.eq('status', filters.status.trim());
      if (filters.dateFrom) pageQuery = pageQuery.gte('created_at', `${filters.dateFrom}T00:00:00`);
      if (filters.dateTo) pageQuery = pageQuery.lte('created_at', `${filters.dateTo}T23:59:59.999`);
      if (filters.fileName?.trim()) pageQuery = pageQuery.ilike('file_name', `%${filters.fileName.trim()}%`);
      if (filters.runId?.trim()) pageQuery = pageQuery.eq('id', filters.runId.trim());
      if (filters.search?.trim()) {
        const term = filters.search.trim().replace(/[,%()]/g, '');
        pageQuery = pageQuery.or(
          isUuid(term)
            ? `id.eq.${term},file_name.ilike.%${term}%,store_id.ilike.%${term}%`
            : `file_name.ilike.%${term}%,store_id.ilike.%${term}%`
        );
      }

      const { data, error, count } = await pageQuery
        .order('created_at', { ascending: false })
        .range(start, end);
      if (error) {
        throw new Error(error.message);
      }

      const stats: ImportRunStats = {
        totalRuns: count ?? 0,
        totalCreates: 0,
        totalUpdates: 0,
        totalSkipped: 0,
        totalConflicts: 0,
        totalInvalid: 0,
        totalFailed: 0,
      };

      for (let statsStart = 0; ; statsStart += STATS_BATCH_SIZE) {
        let statsQuery = client
          .from('import_runs')
          .select('creates,updates,skipped,conflicts,invalid,failed');

        if (filters.storeId?.trim()) statsQuery = statsQuery.eq('store_id', filters.storeId.trim());
        if (filters.status?.trim()) statsQuery = statsQuery.eq('status', filters.status.trim());
        if (filters.dateFrom) statsQuery = statsQuery.gte('created_at', `${filters.dateFrom}T00:00:00`);
        if (filters.dateTo) statsQuery = statsQuery.lte('created_at', `${filters.dateTo}T23:59:59.999`);
        if (filters.fileName?.trim()) statsQuery = statsQuery.ilike('file_name', `%${filters.fileName.trim()}%`);
        if (filters.runId?.trim()) statsQuery = statsQuery.eq('id', filters.runId.trim());
        if (filters.search?.trim()) {
          const term = filters.search.trim().replace(/[,%()]/g, '');
          statsQuery = statsQuery.or(
            isUuid(term)
              ? `id.eq.${term},file_name.ilike.%${term}%,store_id.ilike.%${term}%`
              : `file_name.ilike.%${term}%,store_id.ilike.%${term}%`
          );
        }

        const { data: statsData, error: statsError } = await statsQuery
          .order('created_at', { ascending: false })
          .range(statsStart, statsStart + STATS_BATCH_SIZE - 1);

        if (statsError) {
          throw new Error(statsError.message);
        }

        const rows = (statsData ?? []) as SupabaseRow[];
        for (const row of rows) {
          stats.totalCreates += asNumber(row.creates);
          stats.totalUpdates += asNumber(row.updates);
          stats.totalSkipped += asNumber(row.skipped);
          stats.totalConflicts += asNumber(row.conflicts);
          stats.totalInvalid += asNumber(row.invalid);
          stats.totalFailed += asNumber(row.failed);
        }

        if (rows.length < STATS_BATCH_SIZE) break;
      }

      return {
        runs: ((data ?? []) as SupabaseRow[]).map(mapImportRun),
        total: count ?? 0,
        page,
        pageSize,
        stats,
      };
    },

    async getRun(runId: string): Promise<ImportRun | null> {
      const { data, error } = await client
        .from('import_runs')
        .select('*')
        .eq('id', runId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return data ? mapImportRun(data as SupabaseRow) : null;
    },

    async getRunItems(
      runId: string,
      input: GetImportRunItemsInput = {}
    ): Promise<GetImportRunItemsResult> {
      const page = clampPage(input.page);
      const pageSize = clampPageSize(input.pageSize, ITEMS_PAGE_SIZE);
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      let query = client
        .from('import_run_items')
        .select('*', { count: 'exact' })
        .eq('run_id', runId);

      if (input.action) {
        query = query.eq('action', input.action);
      }
      if (input.executionStatus) {
        query = query.eq('execution_status', input.executionStatus);
      }

      const { data, error, count } = await query
        .order('row_number', { ascending: true })
        .range(start, end);

      if (error) {
        throw new Error(error.message);
      }

      return {
        items: ((data ?? []) as SupabaseRow[]).map(mapImportRunItem),
        total: count ?? 0,
        page,
        pageSize,
      };
    },

    async exportPending(runId: string): Promise<string> {
      const pendingItems: ImportRunItem[] = [];

      for (let start = 0; ; start += STATS_BATCH_SIZE) {
        const { data, error } = await client
          .from('import_run_items')
          .select('*')
          .eq('run_id', runId)
          .or('action.in.(conflict,invalid),execution_status.eq.failed')
          .order('row_number', { ascending: true })
          .range(start, start + STATS_BATCH_SIZE - 1);

        if (error) {
          throw new Error(error.message);
        }

        const rows = ((data ?? []) as SupabaseRow[]).map(mapImportRunItem);
        pendingItems.push(...rows);
        if (rows.length < STATS_BATCH_SIZE) break;
      }

      const header = ['row', 'code', 'id_int', 'mlb', 'title', 'reason'];
      const lines = pendingItems.map((item) => {
        const mlb = getPayloadField(item.payload, 'id_string')
          ?? (Array.isArray(getPayloadField(item.payload, 'mlb_ids'))
            ? (getPayloadField(item.payload, 'mlb_ids') as unknown[])[0]
            : null);
        const reason = item.executionError
          ?? item.reason
          ?? item.errors.map(String).join(', ');

        return [
          item.row,
          getPayloadField(item.payload, 'code'),
          getPayloadField(item.payload, 'id_int'),
          mlb,
          getPayloadField(item.payload, 'title')
            ?? getPayloadField(item.payload, 'marketplace_name'),
          reason,
        ].map(csvCell).join(',');
      });

      return [header.join(','), ...lines].join('\r\n');
    },
  };
};

export const supabaseImportHistoryAdapter: ImportHistoryAdapter =
  createSupabaseImportHistoryAdapter();
