import { supabase } from '../../../lib/supabaseClient';
import type { ExecutionPlan, ExecutionAction } from '../../../planners/buildExecutionPlan';
import type { MongoInventoryPayload } from '../../../core/buildPersistencePayload';
import { sanitizeSupabasePayload } from './sanitizeSupabasePayload';

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

interface PersistExecutionOptions {
  batchSize?: number;
  onProgress?: (progress: number) => void;
}

const isExecutable = (action: ExecutionAction): boolean =>
  action.type === 'create' || action.type === 'update';

export async function persistExecutionPlan(
  executionPlan: ExecutionPlan,
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
      const payload = action.payload as MongoInventoryPayload | undefined;

      if (!payload || typeof payload !== 'object') {
        result.failed += 1;
        result.errors.push({ row: action.row, reason: 'Missing or invalid payload' });
        continue;
      }

      const dbPayload = sanitizeSupabasePayload(payload);

      if (action.type === 'create') {
        try {
          const { error } = await supabase.from('inventory_items').insert(dbPayload);
          if (error) {
            result.failed += 1;
            result.errors.push({ row: action.row, reason: error.message, payload });
            continue;
          }

          result.created += 1;
          continue;
        } catch (err: any) {
          result.failed += 1;
          result.errors.push({ row: action.row, reason: String(err), payload });
          continue;
        }
      }

      if (action.type === 'update') {
        if (!action.targetId || String(action.targetId).trim() === '') {
          result.failed += 1;
          result.errors.push({ row: action.row, reason: 'Missing targetId for update', payload });
          continue;
        }

        try {
          const { error } = await supabase
            .from('inventory_items')
            .update(dbPayload)
            .eq('id', action.targetId);

          if (error) {
            result.failed += 1;
            result.errors.push({ row: action.row, reason: error.message, payload, targetId: action.targetId });
            continue;
          }

          result.updated += 1;
          continue;
        } catch (err: any) {
          result.failed += 1;
          result.errors.push({ row: action.row, reason: String(err), payload, targetId: action.targetId });
          continue;
        }
      }
    }

    const progress = Math.min(100, Math.round(((start + batch.length) / executableActions.length) * 100));
    onProgress?.(progress);
  }

  return result;
}
