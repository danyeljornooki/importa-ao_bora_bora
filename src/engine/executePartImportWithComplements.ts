import type { MarketplaceAdapter } from '../adapters/mercado-livre/mercadoLivreAdapter';
import { buildImagePlan } from '../core/images/buildImagePlan';
import { resolveAdLink } from '../core/marketplace/ad-link/resolveAdLink';
import { executeAdLinkDecision } from '../core/marketplace/ad-registry/executeAdLinkDecision';
import { persistExecutionPlan } from '../core/importer/execution/persistExecutionPlan';
import type {
  PersistExecutionResult,
  PersistExecutionRowResult,
} from '../modules/importer/persistence/persistExecutionPlan';
import type { PartCanonical } from '../modules/importer/schemas/part.schema';
import type {
  ExecutionAction,
  ExecutionPlan,
} from '../planners/buildExecutionPlan';
import type { ImportHistoryAdapter, SaveImportRunItemInput } from '../types/importHistory.types';
import type { ImportExecutionContext } from '../types/integration.types';
import type {
  ExistingInventoryItem,
  InventoryPersistenceAdapter,
} from '../types/inventory.types';
import type { MarketplaceAdRegistryAdapter } from '../types/marketplaceAd.types';
import type {
  PartImportAdLinkResult,
  PartImportCommitSummary,
  PartImportComplementsSummary,
  PartImportImageResult,
  PartImportRowExecutionResult,
} from '../types/partImportExecution.types';
import type { RunImportResult } from './runImport';

export interface ExecutePartImportWithComplementsOptions {
  enableAdLink?: boolean;
  enableImagePlan?: boolean;
  fileName?: string | null;
  adapterName?: string;
  engineVersion?: string;
  metadata?: Record<string, unknown>;
  onProgress?: (progress: number) => void;
}

export interface ExecutePartImportWithComplementsInput {
  analysisResult: RunImportResult;
  executionContext: ImportExecutionContext;
  inventoryAdapter: InventoryPersistenceAdapter;
  historyAdapter: ImportHistoryAdapter;
  adRegistryAdapter: MarketplaceAdRegistryAdapter;
  marketplaceAdapter: MarketplaceAdapter;
  options?: ExecutePartImportWithComplementsOptions;
}

export interface ExecutePartImportWithComplementsResult {
  runId: string;
  importResult: RunImportResult;
  persistResult: PersistExecutionResult;
  rows: PartImportRowExecutionResult[];
  complementSummary: PartImportComplementsSummary;
  summary: PartImportCommitSummary;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const normalizeMlbIds = (part: PartCanonical | undefined): string[] => [
  ...new Set(
    (part?.mlb_ids ?? [])
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean)
  ),
];

const skippedImageResult = (): PartImportImageResult => ({
  action: 'skipped',
  source: 'none',
  count: 0,
  urls: [],
  error: null,
});

const buildPartOnlyExecutionPlan = (
  executionPlan: ExecutionPlan
): ExecutionPlan => ({
  summary: { ...executionPlan.summary },
  actions: executionPlan.actions.map((action) => {
    if (
      action.type !== 'create' ||
      !action.payload ||
      typeof action.payload !== 'object'
    ) {
      return { ...action };
    }

    return {
      ...action,
      payload: {
        ...action.payload,
        images: [],
        image_count: 0,
      },
    };
  }),
});

const buildPiece = (
  part: PartCanonical,
  pecaId: string,
  storeId: string
): ExistingInventoryItem => ({
  id: pecaId,
  store_id: storeId,
  id_int:
    typeof part.id_int === 'number'
      ? part.id_int
      : Number.isFinite(Number(part.id_int))
        ? Number(part.id_int)
        : null,
  id_string: part.id_string ?? null,
  code: part.code ?? null,
  marketplace_name: part.marketplace_name ?? part.title ?? null,
  title: part.title ?? null,
  description: part.description ?? null,
  stock_quantity: part.stock_quantity,
  price: part.price,
  status: part.status ?? null,
  deleted: part.deleted ?? null,
  updated_at: part.updated_at ?? null,
});

const mergeHistoryPayload = (
  payload: unknown,
  part: PartCanonical | undefined,
  result: PartImportRowExecutionResult
): Record<string, unknown> => {
  const base =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? { ...(payload as Record<string, unknown>) }
      : part
        ? { ...part }
        : {};

  return {
    ...base,
    partResult: { ...result.partResult },
    adLinkResult: { ...result.adLinkResult },
    imagePlan: {
      ...result.imagePlan,
      urls: [...result.imagePlan.urls],
    },
  };
};

const summarizeComplements = (
  rows: PartImportRowExecutionResult[]
): PartImportComplementsSummary => ({
  complementPending:
    rows.filter((row) =>
      ['pending', 'conflict', 'invalid'].includes(row.adLinkResult.action)
    ).length +
    rows.filter((row) =>
      ['failed', 'pending'].includes(row.imagePlan.action)
    ).length,
  linkedAds: rows.filter((row) =>
    ['inserted', 'updated', 'linked'].includes(row.adLinkResult.action)
  ).length,
  pendingAds: rows.filter((row) => row.adLinkResult.action === 'pending').length,
  failedAds: rows.filter((row) =>
    ['failed', 'conflict', 'invalid'].includes(row.adLinkResult.action)
  ).length,
  mlImages: rows.filter((row) => row.imagePlan.action === 'used_ml').length,
  sheetImages: rows.filter((row) => row.imagePlan.action === 'used_sheet').length,
  noImage: rows.filter((row) => row.imagePlan.action === 'no_image').length,
});

const buildCommitSummary = (
  persistResult: PersistExecutionResult,
  complementSummary: PartImportComplementsSummary
): PartImportCommitSummary => ({
  created: persistResult.created,
  updated: persistResult.updated,
  skipped: persistResult.skipped,
  failed: persistResult.failed,
  pending:
    persistResult.conflicts +
    persistResult.invalid +
    persistResult.failed,
  ...complementSummary,
});

const buildHistoryItems = (
  actions: ExecutionAction[],
  partsByRow: Map<number, PartCanonical>,
  rows: PartImportRowExecutionResult[]
): SaveImportRunItemInput[] => {
  const resultsByRow = new Map(rows.map((row) => [row.row, row]));

  return actions.map((action) => {
    const result = resultsByRow.get(action.row);
    if (!result) {
      throw new Error(`resultado composto ausente para linha ${action.row}`);
    }

    return {
      row: action.row,
      action: action.type,
      targetId: result.partResult.pecaId ?? action.targetId ?? null,
      reason: action.reason,
      payload: mergeHistoryPayload(
        action.payload,
        partsByRow.get(action.row),
        result
      ),
      warnings: [...new Set([...(action.warnings ?? []), ...result.warnings])],
      errors: result.partResult.error ? [result.partResult.error] : [],
      executionStatus:
        result.partResult.action === 'failed'
          ? 'failed'
          : result.partResult.action === 'skipped'
            ? 'skipped'
            : 'success',
      executionError: result.partResult.error ?? null,
    };
  });
};

const processAdLink = async (
  input: ExecutePartImportWithComplementsInput,
  part: PartCanonical,
  persisted: PersistExecutionRowResult,
  warnings: string[]
): Promise<{
  result: PartImportAdLinkResult;
  mlImageUrls: string[];
}> => {
  const mlbIds = normalizeMlbIds(part);
  if (input.options?.enableAdLink === false || mlbIds.length === 0) {
    return {
      result: {
        action: 'skipped',
        mlbId: mlbIds[0] ?? null,
        chosenMlbId: null,
        adId: null,
        reason:
          input.options?.enableAdLink === false
            ? 'AdLink desabilitado'
            : 'linha sem mlb_ids',
        error: null,
      },
      mlImageUrls: [],
    };
  }

  if (!persisted.pecaId) {
    const reason = 'peça persistida sem pecaId; vínculo de anúncio pendente';
    warnings.push(reason);
    return {
      result: {
        action: 'pending',
        mlbId: mlbIds[0],
        chosenMlbId: null,
        adId: null,
        reason,
        error: null,
      },
      mlImageUrls: [],
    };
  }

  try {
    const decision = await resolveAdLink(
      {
        peca: buildPiece(
          part,
          persisted.pecaId,
          input.executionContext.storeId
        ),
        context: input.executionContext,
        mlbIds,
      },
      input.adRegistryAdapter,
      input.marketplaceAdapter
    );

    warnings.push(...decision.warnings);
    const mlImageUrls = decision.chosenCandidate?.item?.pictures ?? [];

    if (decision.action === 'invalid') {
      warnings.push(decision.reason);
      return {
        result: {
          action: 'pending',
          mlbId: mlbIds[0] ?? null,
          chosenMlbId: decision.chosenMlbId ?? null,
          adId: null,
          reason: decision.reason,
          error:
            decision.invalidCandidates
              .map((candidate) => candidate.errorMessage)
              .filter(Boolean)
              .join('; ') || null,
        },
        mlImageUrls,
      };
    }

    if (decision.action === 'conflict') {
      warnings.push(decision.reason);
      return {
        result: {
          action: 'conflict',
          mlbId: decision.chosenMlbId ?? mlbIds[0] ?? null,
          chosenMlbId: decision.chosenMlbId ?? null,
          adId: null,
          reason: decision.reason,
          error: null,
        },
        mlImageUrls,
      };
    }

    const execution = await executeAdLinkDecision({
      decision,
      context: input.executionContext,
      pecaId: persisted.pecaId,
      adRegistryAdapter: input.adRegistryAdapter,
    });

    if (execution.action === 'failed') {
      warnings.push(execution.error ?? execution.message);
    }

    return {
      result: {
        action:
          execution.action === 'skipped' ? 'pending' : execution.action,
        mlbId: execution.mlbId ?? decision.chosenMlbId ?? null,
        chosenMlbId: decision.chosenMlbId ?? null,
        adId: execution.adId ?? null,
        reason: execution.message,
        error: execution.error ?? null,
      },
      mlImageUrls,
    };
  } catch (error) {
    const message = errorMessage(error);
    warnings.push(`falha no complemento de anúncio: ${message}`);
    return {
      result: {
        action: 'failed',
        mlbId: mlbIds[0] ?? null,
        chosenMlbId: null,
        adId: null,
        reason: 'falha ao resolver ou vincular anúncio',
        error: message,
      },
      mlImageUrls: [],
    };
  }
};

export const executePartImportWithComplements = async (
  input: ExecutePartImportWithComplementsInput
): Promise<ExecutePartImportWithComplementsResult> => {
  const startTime = Date.now();
  const options = input.options ?? {};
  let runId: string | null = null;

  try {
    const createdRun = await input.historyAdapter.createRun({
      storeId: input.executionContext.storeId,
      adapter: options.adapterName ?? 'supabase',
      engineVersion: options.engineVersion ?? '1.1.0',
      fileName: options.fileName ?? null,
      sheetName: input.analysisResult.sheetName,
      metadata: {
        integrationId: input.executionContext.integrationId,
        channel: input.executionContext.channel,
        enableAdLink: options.enableAdLink !== false,
        enableImagePlan: options.enableImagePlan !== false,
        ...(options.metadata ? { ...options.metadata } : {}),
      },
    });
    runId = createdRun.id;

    const persistResult = await persistExecutionPlan(
      buildPartOnlyExecutionPlan(input.analysisResult.executionPlan),
      input.inventoryAdapter,
      {
        onProgress: options.onProgress,
        storeId: input.executionContext.storeId,
      }
    );

    const partsByRow = new Map(
      input.analysisResult.importPlan.actions.flatMap((action) =>
        action.data ? [[action.row, action.data] as const] : []
      )
    );
    const persistedByRow = new Map(
      persistResult.rows.map((row) => [row.row, row])
    );
    const rows: PartImportRowExecutionResult[] = [];

    for (const action of input.analysisResult.executionPlan.actions) {
      const persisted = persistedByRow.get(action.row) ?? {
        row: action.row,
        action: 'failed' as const,
        pecaId: action.targetId ?? null,
        error: 'resultado de persistência ausente',
      };
      const warnings: string[] = [...(action.warnings ?? [])];
      const part = partsByRow.get(action.row);

      if (
        persisted.action === 'failed' ||
        !part
      ) {
        rows.push({
          row: action.row,
          partResult: {
            action: persisted.action,
            pecaId: persisted.pecaId,
            error: persisted.error,
          },
          adLinkResult: {
            action: 'skipped',
            mlbId: null,
            chosenMlbId: null,
            adId: null,
            reason: 'peça não disponível para complementos',
            error: null,
          },
          imagePlan: skippedImageResult(),
          warnings,
        });
        continue;
      }

      const adLink = await processAdLink(input, part, persisted, warnings);
      const images =
        options.enableImagePlan === false
          ? skippedImageResult()
          : buildImagePlan({
              mlImageUrls: adLink.mlImageUrls,
              sheetImageUrls: part.image_urls,
            });

      rows.push({
        row: action.row,
        partResult: {
          action: persisted.action,
          pecaId: persisted.pecaId,
          error: persisted.error,
        },
        adLinkResult: adLink.result,
        imagePlan: images,
        warnings: [...new Set(warnings)],
      });
    }

    const complementSummary = summarizeComplements(rows);
    const summary = buildCommitSummary(persistResult, complementSummary);
    await input.historyAdapter.saveRunItems(
      runId,
      buildHistoryItems(
        input.analysisResult.executionPlan.actions,
        partsByRow,
        rows
      )
    );

    await input.historyAdapter.completeRun(runId, {
      totalRows: input.analysisResult.summary.totalRows,
      validRows: input.analysisResult.summary.valid,
      creates: input.analysisResult.summary.creates,
      updates: input.analysisResult.summary.updates,
      skipped: input.analysisResult.summary.skipped,
      conflicts: input.analysisResult.summary.conflicts,
      invalid: input.analysisResult.summary.invalid,
      warningsCount: rows.reduce(
        (total, row) => total + row.warnings.length,
        input.analysisResult.summary.warnings
      ),
      failed: persistResult.failed,
      durationMs: Date.now() - startTime,
      summary: {
        sheetName: input.analysisResult.sheetName,
        import: { ...input.analysisResult.summary },
        persistence: {
          total: persistResult.total,
          created: persistResult.created,
          updated: persistResult.updated,
          skipped: persistResult.skipped,
          conflicts: persistResult.conflicts,
          invalid: persistResult.invalid,
          failed: persistResult.failed,
        },
        commit: { ...summary },
        complements: { ...complementSummary },
      },
    });

    return {
      runId,
      importResult: input.analysisResult,
      persistResult,
      rows,
      complementSummary,
      summary,
    };
  } catch (error) {
    if (runId) {
      try {
        await input.historyAdapter.failRun(runId, {
          error: errorMessage(error),
        });
      } catch {
        // Preserve the original import error.
      }
    }

    throw error;
  }
};

export default executePartImportWithComplements;
