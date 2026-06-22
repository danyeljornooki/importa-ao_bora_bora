import { parseExcel } from '../core/importer/parse/parseExcel';
import { normalizePart } from '../core/importer/normalize/normalizePart';
import { validatePart, type ValidationResult } from '../core/importer/validate/validatePart';
import { matchPart } from '../core/importer/matching/matchPart';
import { comparePart } from '../core/importer/compare/comparePart';
import { buildImportPlan } from '../core/importer/planner/buildImportPlan';
import buildExecutionPlan from '../core/importer/execution/buildExecutionPlan';
import { normalizeImportError } from '../validators/errorNormalizer';
import { logger } from '../utils/logger';
import { getExistingPartsIdentifierStats } from '../core/importer/matching/inventoryStats';
import { buildInventoryIndex } from '../core/importer/matching/buildInventoryIndex';
import { evaluateRowFilters, type RowFilterRule } from '../modules/importer/rowFilters';
import { applyColumnMapping, type ColumnMapping } from '../modules/importer/suggestFieldMapping';

import type { PartCanonical } from '../modules/importer/schemas/part.schema';
import type { ImportPlan } from '../modules/importer/planner/buildImportPlan';
import type { ExecutionPlan } from '../planners/buildExecutionPlan';
import type { ParsedExcel } from '../modules/importer/parseExcel';
import type { PartChange } from '../modules/importer/comparators/comparePart';
import type {
  ExistingInventoryItem,
  InventoryPersistenceAdapter,
} from '../types/inventory.types';

export interface RunImportOptions {
  storeId: string | number;
  adapter: InventoryPersistenceAdapter;
  integrationId?: string | number | null;
  sheetTitle?: string;
  debugMatching?: boolean;
  /** Regras configuraveis pelo usuario: linhas que casam NAO sao importadas. */
  rowFilters?: RowFilterRule[];
  /** Mapeamento confirmado de coluna -> campo (sobrescreve a auto-deteccao por alias). */
  columnMapping?: ColumnMapping;
}

export interface ExcludedRow {
  row: number;
  reason: string;
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
  failedMatches?: FailedMatch[];
  topFailureReasons?: { reason: string; count: number }[];
  topMissingCodes?: { code: string; count: number }[];
  failedByIdentifierCount?: { id_int: number; mlb_id: number; code: number };
  existingPartsIdentifierStats?: any;
  topMissExamples?: FailedMatch[];
}

export type LogSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface LogEntry {
  severity: LogSeverity;
  message: string;
  row?: number;
  code?: string;
  details?: Record<string, unknown>;
}

export interface CompactChange {
  field: string;
  old: unknown;
  new: unknown;
}

export interface CompactAttentionItem {
  row: number;
  code?: string;
  title?: string;
  reason: string;
  severity: LogSeverity;
  matched_by?: string;
  matched_code?: string;
  confidence?: number;
  changes?: CompactChange[];
}

export interface QualityStats {
  sem_descricao: number;
  sem_imagem: number;
  sem_localizacao: number;
  sem_mlb: number;
  possiveis_duplicadas: number;
  estoque_zerado: number;
}

export interface ImportSummary {
  total: number;
  criadas: number;
  atualizadas: number;
  sem_alteracao: number;
  conflitos: number;
  invalidas: number;
  falhas: number;
  duracao_ms: number;
  duracao: string;
}

export interface ConflictDetail {
  imported: {
    row: number;
    code: string | null;
    id_int: string | number | null;
    mlb_id: string | null;
    title: string | null;
  };
  candidate: {
    id: string | null;
    code: string | null;
    id_int: number | null;
    id_string: string | null;
    title: string | null;
  };
  reason: 'title_similarity';
  finalAction: 'create' | 'conflict';
  warning?: string;
}

export interface RunImportResult {
  sheetName: string;
  resumo: ImportSummary;
  qualidade: QualityStats;
  logs: LogEntry[];
  atencao: CompactAttentionItem[];
  conflictDetails: ConflictDetail[];
  compareDebugUpdates: Array<{
    row: number;
    matchedBy: string | null;
    totalChanges: number;
    changes: PartChange[];
  }>;
  /** Linhas removidas por regra de filtro do usuario (nao entram no pipeline). */
  excluded: number;
  excludedRows: ExcludedRow[];
  // Mantendo para compatibilidade
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
  matchingStats?: {
    totalRows: number;
    existingPartsCount: number;
    create: number;
    update: number;
    conflict: number;
    invalid: number;
    matchedBy: { id_int: number; code: number; mlb_id: number; title: number };
  };
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

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

const analyzeQuality = (part: PartCanonical): { [K in keyof QualityStats]: boolean } => {
  const hasNoDescription = !part.description || part.description.trim() === '';
  const hasNoImage = !part.image_urls || part.image_urls.length === 0;
  const hasNoLocation = !part.location || part.location.trim() === '';
  const hasNoMlb = (!part.mlb_ids || part.mlb_ids.length === 0) && !part.id_string;
  const hasZeroStock = part.stock_quantity === 0;
  
  return {
    sem_descricao: hasNoDescription,
    sem_imagem: hasNoImage,
    sem_localizacao: hasNoLocation,
    sem_mlb: hasNoMlb,
    possiveis_duplicadas: false, // Será marcado separadamente
    estoque_zerado: hasZeroStock,
  };
};

export const runImport = async (
  fileBuffer: ArrayBuffer,
  options: RunImportOptions
): Promise<RunImportResult> => {
  if (!hasStoreId(options?.storeId)) {
    throw new Error('storeId obrigatorio para runImport');
  }
  if (!options?.adapter) {
    throw new Error('adapter obrigatorio para runImport');
  }

  const startTime = Date.now();
  const debugMatching = options.debugMatching === true;
  const storeId = String(options.storeId);

  const fileName = options.sheetTitle ? `${options.sheetTitle}.xlsx` : 'import.xlsx';
  const file = new File([fileBuffer], fileName);

  const parsed: ParsedExcel = await parseExcel(file as any);

  const rowFilters = options.rowFilters ?? [];
  const columnMapping = options.columnMapping;
  const excludedRows: ExcludedRow[] = [];

  const rows: RowState[] = [];
  parsed.rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const rawRow = row as Record<string, unknown>;

    // Regras de exclusao do usuario: rodam sobre a linha CRUA. Linha excluida
    // sai do pipeline (nao vira create/update/invalid) e e reportada a parte.
    const filter = evaluateRowFilters(rawRow, rowFilters);
    if (filter.excluded) {
      excludedRows.push({ row: rowNumber, reason: filter.reason ?? 'linha excluída por regra' });
      return;
    }

    try {
      const effectiveRow = applyColumnMapping(rawRow, columnMapping);
      const normalized = normalizePart(effectiveRow as any, parsed.sheetName);
      const validation = validatePart(normalized);

      rows.push({ row: rowNumber, raw: rawRow, normalized, validation });
    } catch (err) {
      const normalizedErr = normalizeImportError(err);
      logger.error('row=', rowNumber, 'error=', normalizedErr);

      rows.push({ row: rowNumber, raw: rawRow, error: normalizedErr.message });
    }
  });

  const existingParts = await options.adapter.loadStoreInventory(storeId);
  const inventoryIndex = buildInventoryIndex(existingParts);
  const existingPartsIdentifierStats = getExistingPartsIdentifierStats(existingParts);

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

  // Novas estruturas para o output compacto
  const logs: LogEntry[] = [];
  const atencao: CompactAttentionItem[] = [];
  const qualityStats: QualityStats = {
    sem_descricao: 0,
    sem_imagem: 0,
    sem_localizacao: 0,
    sem_mlb: 0,
    possiveis_duplicadas: 0,
    estoque_zerado: 0,
  };

  const counters = {
    total: parsed.rows.length,
    criadas: 0,
    atualizadas: 0,
    sem_alteracao: 0,
    conflitos: 0,
    invalidas: 0,
    falhas: 0,
  };

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
      counters.invalidas += 1;
      if (matchingTracking) matchingTracking.invalid += 1;

      logs.push({
        severity: 'ERROR',
        message: `Linha ${rowState.row}: ${rowState.error ?? 'linha inválida'}`,
        row: rowState.row,
      });

      atencao.push({
        row: rowState.row,
        reason: rowState.error ?? 'linha inválida',
        severity: 'ERROR',
      });

      continue;
    }

    const normalized = rowState.normalized;
    const validation = rowState.validation ?? validatePart(normalized);
    const qualityFlags = analyzeQuality(normalized);

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
      counters.invalidas += 1;
      if (matchingTracking) matchingTracking.invalid += 1;

      logs.push({
        severity: 'ERROR',
        message: `Linha ${rowState.row}: ${validation.errors.join(', ')}`,
        row: rowState.row,
        code: normalized.code ?? undefined,
      });

      atencao.push({
        row: rowState.row,
        code: normalized.code ?? undefined,
        title: normalized.title ?? undefined,
        reason: validation.errors.join(', '),
        severity: 'ERROR',
      });

      continue;
    }

    const match = matchPart(normalized, inventoryIndex);

    if (matchingTracking) {
      if (match.matchedBy === 'id_int') matchingTracking.matchedBy.id_int += 1;
      else if (match.matchedBy === 'code') matchingTracking.matchedBy.code += 1;
      else if (match.matchedBy === 'mlb_id') matchingTracking.matchedBy.mlb_id += 1;
      else if (match.matchedBy === 'title') matchingTracking.matchedBy.title += 1;
    }

    // Atualizar estatísticas de qualidade
    if (qualityFlags.sem_descricao) qualityStats.sem_descricao += 1;
    if (qualityFlags.sem_imagem) qualityStats.sem_imagem += 1;
    if (qualityFlags.sem_localizacao) qualityStats.sem_localizacao += 1;
    if (qualityFlags.sem_mlb) qualityStats.sem_mlb += 1;
    if (qualityFlags.estoque_zerado) qualityStats.estoque_zerado += 1;

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

      if (comparison.changed) {
        counters.atualizadas += 1;
        const compactChanges = comparison.changes.map((c) => ({ field: c.field, old: c.oldValue, new: c.newValue }));
        
        logs.push({
          severity: 'INFO',
          message: `Linha ${rowState.row}: Peça ${normalized.code} atualizada (${comparison.totalChanges} alterações)`,
          row: rowState.row,
          code: normalized.code ?? undefined,
          details: { changes: compactChanges },
        });

        atencao.push({
          row: rowState.row,
          code: normalized.code ?? undefined,
          title: normalized.title ?? undefined,
          reason: 'peça atualizada',
          severity: 'INFO',
          matched_by: match.matchedBy ?? undefined,
          changes: compactChanges,
        });
      } else {
        counters.sem_alteracao += 1;
        logs.push({
          severity: 'INFO',
          message: `Linha ${rowState.row}: Peça ${normalized.code} sem alterações`,
          row: rowState.row,
          code: normalized.code ?? undefined,
        });
      }
      continue;
    }

    if (match.action === 'conflict') {
      if (matchingTracking) matchingTracking.conflict += 1;
      counters.conflitos += 1;
      qualityStats.possiveis_duplicadas += 1;

      const conflictDetails: ConflictDetail = {
        imported: {
          row: rowState.row,
          code: normalized.code ?? null,
          id_int: normalized.id_int ?? null,
          mlb_id: firstMlbId(normalized),
          title: normalized.title ?? null,
        },
        candidate: {
          id: match.existingPart?.id ?? null,
          code: match.existingPart?.code ?? null,
          id_int: match.existingPart?.id_int ?? null,
          id_string: match.existingPart?.id_string ?? null,
          title: match.existingPart?.marketplace_name ?? null,
        },
        reason: 'title_similarity',
        finalAction: 'conflict',
      };

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
        conflictDetails,
      });

      logs.push({
        severity: 'WARNING',
        message: `Linha ${rowState.row}: Possível duplicata para ${normalized.code}`,
        row: rowState.row,
        code: normalized.code ?? undefined,
      });

      atencao.push({
        row: rowState.row,
        code: normalized.code ?? undefined,
        title: normalized.title ?? undefined,
        reason: 'possível peça duplicada',
        severity: 'WARNING',
        matched_by: match.matchedBy ?? undefined,
        matched_code: match.existingPart?.code ?? undefined,
        confidence: match.confidence,
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
    counters.criadas += 1;

    const similarTitleDetails: ConflictDetail | undefined =
      match.titleMatch === 'similar' && match.titleCandidate
        ? {
            imported: {
              row: rowState.row,
              code: normalized.code ?? null,
              id_int: normalized.id_int ?? null,
              mlb_id: firstMlbId(normalized),
              title: normalized.title ?? null,
            },
            candidate: {
              id: match.titleCandidate.id ?? null,
              code: match.titleCandidate.code ?? null,
              id_int: match.titleCandidate.id_int ?? null,
              id_string: match.titleCandidate.id_string ?? null,
              title: match.titleCandidate.marketplace_name ?? null,
            },
            reason: 'title_similarity',
            finalAction: 'create',
            warning: 'possível título semelhante encontrado',
          }
        : undefined;

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
      existingPart: match.titleCandidate,
      errors: validation.errors,
      warnings: [...validation.warnings, ...match.warnings],
      reason: 'nova peca',
      conflictDetails: similarTitleDetails,
    });

    const qualityWarnings: string[] = [];
    if (qualityFlags.sem_descricao) qualityWarnings.push('sem descrição');
    if (qualityFlags.sem_imagem) qualityWarnings.push('sem imagem');
    if (qualityFlags.sem_localizacao) qualityWarnings.push('sem localização');
    if (qualityFlags.sem_mlb) qualityWarnings.push('sem MLB');
    if (qualityFlags.estoque_zerado) qualityWarnings.push('estoque zerado');

    const severity = qualityWarnings.length > 0 ? 'WARNING' : 'INFO';

    logs.push({
      severity,
      message: `Linha ${rowState.row}: Peça ${normalized.code} criada${qualityWarnings.length > 0 ? ` (${qualityWarnings.join(', ')})` : ''}`,
      row: rowState.row,
      code: normalized.code ?? undefined,
    });

    if (qualityWarnings.length > 0) {
      atencao.push({
        row: rowState.row,
        code: normalized.code ?? undefined,
        title: normalized.title ?? undefined,
        reason: `nova peça com avisos: ${qualityWarnings.join(', ')}`,
        severity: 'WARNING',
      });
    }
  }

  const importPlan = buildImportPlan(previewItems as any);
  const executionPlan = buildExecutionPlan(previewItems as any, {
    storeId,
    integrationId: options.integrationId,
  });

  const totalRows = parsed.rows.length;
  const valid = previewItems.filter((p) => p.valid).length;
  // invalid contado dos previewItems (linhas excluidas por regra NAO contam como invalid).
  const invalid = previewItems.filter((p) => !p.valid).length;
  const warnings = previewItems.reduce((acc, p) => acc + (Array.isArray(p.warnings) ? p.warnings.length : 0), 0);
  const creates = importPlan.summary.creates;
  const updates = importPlan.summary.updates;
  const unchangedUpdates = importPlan.summary.unchangedUpdates;
  const conflicts = importPlan.summary.conflicts;
  const skipped = importPlan.summary.skipped;
  const executable = executionPlan.summary.executable;

  const endTime = Date.now();
  const durationMs = endTime - startTime;

  const result: RunImportResult = {
    sheetName: parsed.sheetName,
    resumo: {
      ...counters,
      duracao_ms: durationMs,
      duracao: formatDuration(durationMs),
    },
    qualidade: qualityStats,
    logs,
    atencao: atencao.slice(0, 20),
    conflictDetails: previewItems
      .filter((item) => item.conflictDetails)
      .map((item) => item.conflictDetails),
    compareDebugUpdates: previewItems
      .filter((item) => item.action === 'update')
      .slice(0, 10)
      .map((item) => ({
        row: item.row,
        matchedBy: item.matchedBy ?? null,
        totalChanges: item.totalChanges,
        changes: item.changes,
      })),
    excluded: excludedRows.length,
    excludedRows,
    // Mantendo para compatibilidade
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
    } as MatchingStats;
  }

  return result;
};

export default runImport;
