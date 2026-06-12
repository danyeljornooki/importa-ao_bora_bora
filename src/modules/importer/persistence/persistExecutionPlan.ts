import type { ExecutionPlan, ExecutionAction } from '../../../planners/buildExecutionPlan';
import type {
  InventoryPersistenceAdapter,
  InventoryPersistencePayload,
} from '../../../types/inventory.types';
import type {
  ImportHistoryAdapter,
  SaveImportRunItemInput,
} from '../../../types/importHistory.types';

export interface PersistExecutionResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  conflicts: number;
  invalid: number;
  failed: number;
  errors: Array<{ row?: number; reason: string; payload?: unknown; targetId?: string }>;
  rows: PersistExecutionRowResult[];
}

export interface PersistExecutionRowResult {
  row: number;
  action: 'created' | 'updated' | 'skipped' | 'failed';
  pecaId: string | null;
  error: string | null;
}

export interface PersistExecutionOptions {
  batchSize?: number;
  onProgress?: (progress: number) => void;
  history?: {
    adapter: ImportHistoryAdapter;
    runId: string;
  };
}

const isExecutable = (action: ExecutionAction): boolean =>
  action.type === 'create' || action.type === 'update';

const buildHistoryItem = (action: ExecutionAction): SaveImportRunItemInput => ({
  row: action.row,
  action: action.type,
  targetId: action.targetId ?? null,
  reason: action.reason,
  payload: action.payload,
  executionStatus: isExecutable(action) ? 'pending' : 'skipped',
  executionError: null,
});

export async function persistExecutionPlan(
  executionPlan: ExecutionPlan,
  adapter: InventoryPersistenceAdapter,
  options: PersistExecutionOptions = {}
): Promise<PersistExecutionResult> {
  const batchSize = options.batchSize ?? 500;
  const onProgress = options.onProgress;
  const actions = executionPlan.actions;
  const executableActions = actions.filter(isExecutable);
  const historyItems = actions.map(buildHistoryItem);
  const historyItemsByRow = new Map(
    historyItems.map((item) => [item.row, item])
  );

  const result: PersistExecutionResult = {
    total: executableActions.length,
    created: 0,
    updated: 0,
    skipped: actions.filter((action) => action.type === 'skip').length,
    conflicts: actions.filter((action) => action.type === 'conflict').length,
    invalid: actions.filter((action) => action.type === 'invalid').length,
    failed: 0,
    errors: [],
    rows: actions.flatMap((action): PersistExecutionRowResult[] => {
      if (action.type === 'skip') {
        return [{
          row: action.row,
          action: 'skipped',
          pecaId: action.targetId ?? null,
          error: null,
        }];
      }

      if (action.type === 'conflict' || action.type === 'invalid') {
        return [{
          row: action.row,
          action: action.type === 'invalid' ? 'failed' : 'skipped',
          pecaId: action.targetId ?? null,
          error: action.reason,
        }];
      }

      return [];
    }),
  };

  if (executableActions.length === 0) {
    if (options.history) {
      await options.history.adapter.saveRunItems(
        options.history.runId,
        historyItems
      );
    }
    onProgress?.(100);
    return result;
  }

  for (let start = 0; start < executableActions.length; start += batchSize) {
    const batch = executableActions.slice(start, start + batchSize);

    for (const action of batch) {
      const payload = action.payload as InventoryPersistencePayload | undefined;
      const historyItem = historyItemsByRow.get(action.row);

      if (!payload || typeof payload !== 'object') {
        const executionError = 'Missing or invalid payload';
        result.failed += 1;
        result.errors.push({ row: action.row, reason: executionError });
        if (historyItem) {
          historyItem.executionStatus = 'failed';
          historyItem.executionError = executionError;
        }
        result.rows.push({
          row: action.row,
          action: 'failed',
          pecaId: action.targetId ?? null,
          error: executionError,
        });
        continue;
      }

      if (action.type === 'create') {
        let actionResult;
        try {
          actionResult = await adapter.createItem(payload);
        } catch (error) {
          actionResult = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
        if (!actionResult.success) {
          const executionError = actionResult.error ?? 'Create failed';
          result.failed += 1;
          result.errors.push({
            row: action.row,
            reason: executionError,
            payload,
          });
          if (historyItem) {
            historyItem.executionStatus = 'failed';
            historyItem.executionError = executionError;
          }
          result.rows.push({
            row: action.row,
            action: 'failed',
            pecaId: null,
            error: executionError,
          });
          continue;
        }

        result.created += 1;
        result.rows.push({
          row: action.row,
          action: 'created',
          pecaId: actionResult.id ?? null,
          error: null,
        });
        if (historyItem) {
          historyItem.targetId = actionResult.id ?? historyItem.targetId ?? null;
          historyItem.executionStatus = 'success';
        }
        continue;
      }

      if (action.type === 'update') {
        if (!action.targetId || String(action.targetId).trim() === '') {
          const executionError = 'Missing targetId for update';
          result.failed += 1;
          result.errors.push({
            row: action.row,
            reason: executionError,
            payload,
          });
          if (historyItem) {
            historyItem.executionStatus = 'failed';
            historyItem.executionError = executionError;
          }
          result.rows.push({
            row: action.row,
            action: 'failed',
            pecaId: null,
            error: executionError,
          });
          continue;
        }

        let actionResult;
        try {
          actionResult = await adapter.updateItem(action.targetId, payload);
        } catch (error) {
          actionResult = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
        if (!actionResult.success) {
          const executionError = actionResult.error ?? 'Update failed';
          result.failed += 1;
          result.errors.push({
            row: action.row,
            reason: executionError,
            payload,
            targetId: action.targetId,
          });
          if (historyItem) {
            historyItem.executionStatus = 'failed';
            historyItem.executionError = executionError;
          }
          result.rows.push({
            row: action.row,
            action: 'failed',
            pecaId: action.targetId,
            error: executionError,
          });
          continue;
        }

        result.updated += 1;
        result.rows.push({
          row: action.row,
          action: 'updated',
          pecaId: actionResult.id ?? action.targetId,
          error: null,
        });
        if (historyItem) {
          historyItem.executionStatus = 'success';
        }
      }
    }

    const progress = Math.min(
      100,
      Math.round(((start + batch.length) / executableActions.length) * 100)
    );
    onProgress?.(progress);
  }

  if (options.history) {
    await options.history.adapter.saveRunItems(
      options.history.runId,
      historyItems
    );
  }

  return result;
}
