import { parseExcel } from '../modules/importer/parseExcel';
import { normalizePart } from '../modules/importer/normalizePart';
import { validatePart, type ValidationResult } from '../modules/importer/validators/validatePart';
import { matchPart } from '../modules/importer/matchers/matchPart';
import { comparePart } from '../modules/importer/comparators/comparePart';
import { buildImportPlan } from '../modules/importer/planner/buildImportPlan';
import buildExecutionPlan from '../planners/buildExecutionPlan';
import { normalizeImportError } from '../validators/errorNormalizer';
import { logger } from '../utils/logger';
import {
  getExistingPartsIdentifierStats,
  loadExistingPartsFromSupabase,
  type ExistingPartsIdentifierStats,
} from '../modules/importer/persistence/loadExistingPartsFromSupabase';
import { buildInventoryIndex } from '../modules/importer/matching/buildInventoryIndex';

import type { PartCanonical } from '../modules/importer/schemas/part.schema';
import type { ImportPlan } from '../modules/importer/planner/buildImportPlan';
import type { ExecutionPlan } from '../planners/buildExecutionPlan';
import type { ParsedExcel } from '../modules/importer/parseExcel';
import type { ExistingInventoryItem } from '../modules/importer/persistence/loadExistingPartsFromSupabase';

export interface RunImportOptions {
  storeId: string | number;
  integrationId?: string | number | null;
  sheetTitle?: string;
  debugMatching?: boolean;
}

export interface FailedMatch {
  row: number;
  code?: string | null;
  id_int?: number | string | null;
  mlb_id?: string | null;
  reason: string;
}

export interface MatchingStats {
  totalRows: number;
  existingPartsCount: number;
  create: number;
  update: number;
  conflict: number;
  invalid: number;
  matchedBy: {
    id_int: number;
    code: number;
    mlb_id: number;
    title: number;
  };
  failedMatches: FailedMatch[];
  topFailureReasons?: { reason: string; count: number }[];
  topMissingCodes?: { code: string; count: number }[];
  failedByIdentifierCount?: { id_int: number; mlb_id: number; code: number };
  existingPartsIdentifierStats?: ExistingPartsIdentifierStats;
  topMissExamples?: FailedMatch[];
}

export interface RunImportResult {
  sheetName: string;
  totalRows: number;
  previewItems: any[];
  importPlan: ImportPlan;
  executionPlan: ExecutionPlan;
  summary: {
    totalRows: number;
    valid: number;
    invalid: number;
    warnings: number;
    creates: number;
    updates: number;
    unchangedUpdates: number;
    conflicts: number;
    skipped: number;
    executable: number;
  };
  matchingStats?: MatchingStats;
}

interface RowState {
  row: number;
  raw: Record<string, unknown>;
  normalized?: PartCanonical;
  validation?: ValidationResult;
  error?: string;
}

const hasStoreId = (storeId: unknown): boolean =>
  storeId !== null && storeId !== undefined && String(storeId).trim() !== '';

const firstMlbId = (part: PartCanonical): string | null =>
  Array.isArray(part.mlb_ids) && part.mlb_ids.length > 0 ? part.mlb_ids[0] : part.id_string ?? null;

const buildFailureAnalytics = (failed: FailedMatch[]) => {
  const reasonCounts = new Map<string, number>();
  const codeCounts = new Map<string, number>();
  let failedByIdInt = 0;
  let failedByMlbId = 0;
  let failedByCode = 0;

  for (const f of failed) {
    const reason = f.reason || 'unknown';
    reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);

    if (f.code) {
      const code = String(f.code);
      codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
    }

    if (f.id_int != null) failedByIdInt += 1;
    if (f.mlb_id) failedByMlbId += 1;
    if (f.code) failedByCode += 1;
  }

  return {
    topFailureReasons: Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    topMissingCodes: Array.from(codeCounts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    failedByIdentifierCount: {
      id_int: failedByIdInt,
      mlb_id: failedByMlbId,
      code: failedByCode,
    },
    topMissExamples: failed.slice(0, 20),
  };
};

export const runImport = async (
  fileBuffer: ArrayBuffer,
  options: RunImportOptions
): Promise<RunImportResult> => {
  if (!hasStoreId(options?.storeId)) {
    throw new Error('storeId obrigatorio para runImport');
  }

  const debugMatching = options.debugMatching === true;
  const storeId = options.storeId;

  const fileName = options.sheetTitle ? `${options.sheetTitle}.xlsx` : 'import.xlsx';
  const file = new File([fileBuffer], fileName);

  const parsed: ParsedExcel = await parseExcel(file as any);

  const rows: RowState[] = parsed.rows.map((row, index) => {
    const rowNumber = index + 1;

    try {
      const normalized = normalizePart(row as any, parsed.sheetName);
      const validation = validatePart(normalized);

      return {
        row: rowNumber,
        raw: row as Record<string, unknown>,
        normalized,
        validation,
      };
    } catch (err) {
      const normalizedErr = normalizeImportError(err);
      logger.error('row=', rowNumber, 'error=', normalizedErr);

      return {
        row: rowNumber,
        raw: row as Record<string, unknown>,
        error: normalizedErr.message,
      };
    }
  });

  const loadedInventory = await loadExistingPartsFromSupabase(storeId);
  const existingParts = loadedInventory.items;
  const inventoryIndex = buildInventoryIndex(existingParts);
  const existingPartsIdentifierStats =
    loadedInventory.identifierStats ?? getExistingPartsIdentifierStats(existingParts);

  const previewItems: any[] = [];
  const matchingTracking = debugMatching
    ? {
        totalRows: parsed.rows.length,
        existingPartsCount: existingParts.length,
        create: 0,
        update: 0,
        conflict: 0,
        invalid: 0,
        matchedBy: { id_int: 0, code: 0, mlb_id: 0, title: 0 },
        failedMatches: [] as FailedMatch[],
      }
    : null;

  for (const rowState of rows) {
    if (!rowState.normalized || rowState.error) {
      previewItems.push({
        row: rowState.row,
        valid: false,
        action: 'invalid',
        changed: false,
        totalChanges: 0,
        changes: [],
        errors: [rowState.error ?? 'linha invalida'],
        warnings: [],
        reason: 'linha invalida',
      });
      if (matchingTracking) matchingTracking.invalid += 1;
      continue;
    }

    const normalized = rowState.normalized;
    const validation = rowState.validation ?? validatePart(normalized);

    if (!validation.valid) {
      previewItems.push({
        row: rowState.row,
        valid: false,
        action: 'invalid',
        changed: false,
        totalChanges: 0,
        changes: [],
        data: normalized,
        errors: validation.errors,
        warnings: validation.warnings,
        reason: 'linha invalida',
      });
      if (matchingTracking) matchingTracking.invalid += 1;
      continue;
    }

    const match = matchPart(normalized, inventoryIndex);

    if (matchingTracking) {
      if (match.matchedBy === 'id_int') matchingTracking.matchedBy.id_int += 1;
      else if (match.matchedBy === 'code') matchingTracking.matchedBy.code += 1;
      else if (match.matchedBy === 'mlb_id') matchingTracking.matchedBy.mlb_id += 1;
      else if (match.matchedBy === 'title') matchingTracking.matchedBy.title += 1;
    }

    if (match.action === 'update' && match.existingPart) {
      const comparison = comparePart(normalized, match.existingPart as any);
      const action = comparison.changed ? 'update' : 'skip';

      if (matchingTracking && comparison.changed) matchingTracking.update += 1;

      previewItems.push({
        row: rowState.row,
        valid: true,
        action,
        matchedBy: match.matchedBy,
        confidence: match.confidence,
        changed: comparison.changed,
        totalChanges: comparison.totalChanges,
        changes: comparison.changes,
        data: normalized,
        existingPart: match.existingPart as ExistingInventoryItem,
        errors: validation.errors,
        warnings: [...validation.warnings, ...match.warnings],
        reason: comparison.changed ? 'peca existente com alteracoes' : 'sem alteracoes',
      });
      continue;
    }

    if (match.action === 'conflict') {
      if (matchingTracking) matchingTracking.conflict += 1;
      previewItems.push({
        row: rowState.row,
        valid: true,
        action: 'conflict',
        matchedBy: match.matchedBy,
        confidence: match.confidence,
        changed: false,
        totalChanges: 0,
        changes: [],
        data: normalized,
        existingPart: match.existingPart,
        errors: validation.errors,
        warnings: [...validation.warnings, ...match.warnings],
        reason: 'possivel peca duplicada',
      });
      continue;
    }

    if (matchingTracking) {
      matchingTracking.create += 1;
      if (matchingTracking.failedMatches.length < 50) {
        matchingTracking.failedMatches.push({
          row: rowState.row,
          code: normalized.code ?? undefined,
          id_int: normalized.id_int ?? undefined,
          mlb_id: firstMlbId(normalized),
          reason: 'no existing part matched',
        });
      }
    }

    previewItems.push({
      row: rowState.row,
      valid: true,
      action: 'create',
      matchedBy: null,
      confidence: 0,
      changed: false,
      totalChanges: 0,
      changes: [],
      data: normalized,
      errors: validation.errors,
      warnings: validation.warnings,
      reason: 'nova peca',
    });
  }

  const importPlan = buildImportPlan(previewItems as any);
  const executionPlan = buildExecutionPlan(previewItems as any, {
    storeId,
    integrationId: options.integrationId,
  });

  const totalRows = parsed.rows.length;
  const valid = previewItems.filter((p) => p.valid).length;
  const invalid = totalRows - valid;
  const warnings = previewItems.reduce((acc, p) => acc + (Array.isArray(p.warnings) ? p.warnings.length : 0), 0);
  const creates = importPlan.summary.creates;
  const updates = importPlan.summary.updates;
  const unchangedUpdates = importPlan.summary.unchangedUpdates;
  const conflicts = importPlan.summary.conflicts;
  const skipped = importPlan.summary.skipped;
  const executable = executionPlan.summary.executable;

  const result: RunImportResult = {
    sheetName: parsed.sheetName,
    totalRows,
    previewItems: previewItems.slice(0, 20).map((p) => ({ ...p })),
    importPlan,
    executionPlan,
    summary: {
      totalRows,
      valid,
      invalid,
      warnings,
      creates,
      updates,
      unchangedUpdates,
      conflicts,
      skipped,
      executable,
    },
  };

  if (debugMatching && matchingTracking) {
    result.matchingStats = {
      ...matchingTracking,
      existingPartsIdentifierStats,
      ...buildFailureAnalytics(matchingTracking.failedMatches),
    };
  }

  return result;
};

export default runImport;
