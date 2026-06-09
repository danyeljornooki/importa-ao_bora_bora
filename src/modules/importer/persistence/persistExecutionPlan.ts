import type { ExecutionPlan, ExecutionAction } from '../../../planners/buildExecutionPlan';
import type {
  InventoryPersistenceAdapter,
  InventoryPersistencePayload,
} from '../../../types/inventory.types';

export interface PersistExecutionResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  conflicts: number;
  invalid: number;
  failed: number;
  errors: Array<{ row?: number; reason: string; payload?: unknown; targetId?: string }>;
}

export interface PersistExecutionOptions {
  batchSize?: number;
  onProgress?: (progress: number) => void;
}

const isExecutable = (action: ExecutionAction): boolean =>
  action.type === 'create' || action.type === 'update';

export async function persistExecutionPlan(
  executionPlan: ExecutionPlan,
  adapter: InventoryPersistenceAdapter,
  options: PersistExecutionOptions = {}
): Promise<PersistExecutionResult> {
  const batchSize = options.batchSize ?? 500;
  const onProgress = options.onProgress;
  const actions = executionPlan.actions;
  const executableActions = actions.filter(isExecutable);

  const result: PersistExecutionResult = {
    total: executableActions.length,
    created: 0,
    updated: 0,
    skipped: actions.filter((action) => action.type === 'skip').length,
    conflicts: actions.filter((action) => action.type === 'conflict').length,
    invalid: actions.filter((action) => action.type === 'invalid').length,
    failed: 0,
    errors: [],
  };

  if (executableActions.length === 0) {
    onProgress?.(100);
    return result;
  }

  for (let start = 0; start < executableActions.length; start += batchSize) {
    const batch = executableActions.slice(start, start + batchSize);

    for (const action of batch) {
      const payload = action.payload as InventoryPersistencePayload | undefined;

      if (!payload || typeof payload !== 'object') {
        result.failed += 1;
        result.errors.push({ row: action.row, reason: 'Missing or invalid payload' });
        continue;
      }

      if (action.type === 'create') {
        const actionResult = await adapter.createItem(payload);
        if (!actionResult.success) {
          result.failed += 1;
          result.errors.push({
            row: action.row,
            reason: actionResult.error ?? 'Create failed',
            payload,
          });
          continue;
        }

        result.created += 1;
        continue;
      }

      if (action.type === 'update') {
        if (!action.targetId || String(action.targetId).trim() === '') {
          result.failed += 1;
          result.errors.push({
            row: action.row,
            reason: 'Missing targetId for update',
            payload,
          });
          continue;
        }

        const actionResult = await adapter.updateItem(action.targetId, payload);
        if (!actionResult.success) {
          result.failed += 1;
          result.errors.push({
            row: action.row,
            reason: actionResult.error ?? 'Update failed',
            payload,
            targetId: action.targetId,
          });
          continue;
        }

        result.updated += 1;
      }
    }

    const progress = Math.min(
      100,
      Math.round(((start + batch.length) / executableActions.length) * 100)
    );
    onProgress?.(progress);
  }

  return result;
}
