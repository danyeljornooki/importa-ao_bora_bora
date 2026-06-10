import { persistExecutionPlan } from '../core/importer/execution/persistExecutionPlan';
import { runImport, type RunImportResult } from './runImport';
import type { PersistExecutionResult } from '../modules/importer/persistence/persistExecutionPlan';
import type { ImportHistoryAdapter } from '../types/importHistory.types';
import type { InventoryPersistenceAdapter } from '../types/inventory.types';

export interface ExecuteImportWithHistoryInput {
  file: File;
  storeId: string;
  inventoryAdapter: InventoryPersistenceAdapter;
  historyAdapter: ImportHistoryAdapter;
  adapterName?: string;
  engineVersion?: string;
  debugMatching?: boolean;
  onProgress?: (progress: number) => void;
}

export interface ExecuteImportWithHistoryResult {
  runId: string;
  importResult: RunImportResult;
  persistResult: PersistExecutionResult;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const executeImportWithHistory = async (
  input: ExecuteImportWithHistoryInput
): Promise<ExecuteImportWithHistoryResult> => {
  const startTime = performance.now();
  let runId: string | null = null;

  try {
    const createdRun = await input.historyAdapter.createRun({
      storeId: input.storeId,
      adapter: input.adapterName ?? 'supabase',
      engineVersion: input.engineVersion ?? '1.0.0',
      fileName: input.file.name,
      sheetName: null,
      metadata: {
        fileSize: input.file.size,
        fileType: input.file.type || null,
        debugMatching: input.debugMatching === true,
      },
    });
    runId = createdRun.id;

    const fileBuffer = await input.file.arrayBuffer();
    const importResult = await runImport(fileBuffer, {
      storeId: input.storeId,
      adapter: input.inventoryAdapter,
      debugMatching: input.debugMatching,
    });

    const persistResult = await persistExecutionPlan(
      importResult.executionPlan,
      input.inventoryAdapter,
      {
        onProgress: input.onProgress,
        history: {
          adapter: input.historyAdapter,
          runId,
        },
      }
    );

    const durationMs = Math.round(performance.now() - startTime);
    await input.historyAdapter.completeRun(runId, {
      totalRows: importResult.summary.totalRows,
      validRows: importResult.summary.valid,
      creates: importResult.summary.creates,
      updates: importResult.summary.updates,
      skipped: importResult.summary.skipped,
      conflicts: importResult.summary.conflicts,
      invalid: importResult.summary.invalid,
      warningsCount: importResult.summary.warnings,
      failed: persistResult.failed,
      durationMs,
      summary: {
        sheetName: importResult.sheetName,
        import: { ...importResult.summary },
        persistence: {
          total: persistResult.total,
          created: persistResult.created,
          updated: persistResult.updated,
          skipped: persistResult.skipped,
          conflicts: persistResult.conflicts,
          invalid: persistResult.invalid,
          failed: persistResult.failed,
        },
      },
    });

    return {
      runId,
      importResult,
      persistResult,
    };
  } catch (error) {
    if (runId) {
      try {
        await input.historyAdapter.failRun(runId, {
          error: errorMessage(error),
        });
      } catch {
        // Preserve the fatal import error if audit finalization also fails.
      }
    }

    throw error;
  }
};

export default executeImportWithHistory;
