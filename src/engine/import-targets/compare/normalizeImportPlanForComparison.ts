import type { RunImportResult } from '../../runImport';
import type {
  ComparableImportPlan,
  ComparableImportRow,
} from './types';

const VOLATILE_KEYS = new Set([
  '_id',
  'id',
  'created_at',
  'updated_at',
  'importedAt',
  'metadata',
  'testRunId',
  'runId',
]);

const normalizeScalar = (value: unknown): unknown => {
  if (value === undefined) return null;
  if (value && typeof value === 'object' && 'toHexString' in value && typeof value.toHexString === 'function') {
    return value.toHexString();
  }
  return value;
};

export const normalizeComparableValue = (value: unknown): unknown => {
  const scalar = normalizeScalar(value);
  if (Array.isArray(scalar)) {
    return scalar
      .map(normalizeComparableValue)
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  if (scalar && typeof scalar === 'object') {
    return Object.fromEntries(
      Object.entries(scalar as Record<string, unknown>)
        .filter(([key]) => !VOLATILE_KEYS.has(key))
        .map(([key, item]) => [key, normalizeComparableValue(item)])
    );
  }
  return scalar;
};

const normalizePayload = (payload: unknown): Record<string, unknown> =>
  (normalizeComparableValue(payload ?? {}) ?? {}) as Record<string, unknown>;

export const normalizeImportPlanForComparison = (
  target: 'supabase' | 'mongo',
  result: Pick<RunImportResult, 'executionPlan' | 'previewItems' | 'summary'>
): ComparableImportPlan => {
  const previewByRow = new Map<number, any>(
    (result.previewItems ?? []).map((item: any) => [Number(item.row), item])
  );

  const rows: ComparableImportRow[] = result.executionPlan.actions.map((action) => {
    const preview = previewByRow.get(action.row) ?? {};
    const data = preview.data ?? {};
    return {
      row: action.row,
      code: data.code ?? null,
      id_int: data.id_int ?? null,
      id_string: data.id_string ?? null,
      mlb_ids: Array.isArray(data.mlb_ids) ? data.mlb_ids : [],
      action: action.type,
      matchedBy: preview.matchedBy ?? null,
      matchedId: action.targetId ?? preview.existingPart?.id ?? null,
      confidence: preview.confidence ?? null,
      reason: action.reason ?? preview.reason ?? null,
      payload: normalizePayload(action.payload),
      warnings: [
        ...(Array.isArray(preview.warnings) ? preview.warnings : []),
        ...(Array.isArray(action.warnings) ? action.warnings : []),
      ].map(String).sort(),
    };
  });

  return {
    target,
    rows,
    summary: {
      totalRows: result.summary.totalRows,
      creates: result.summary.creates,
      updates: result.summary.updates,
      skipped: result.summary.skipped,
      conflicts: result.summary.conflicts,
      invalid: result.summary.invalid,
      warnings: result.summary.warnings,
    },
  };
};
