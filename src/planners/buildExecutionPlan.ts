import type {
  InventoryPersistencePatch,
  InventoryPersistencePayload,
} from '../types/inventory.types';
import { buildPersistencePayload } from '../core/buildPersistencePayload';
import { buildUpdatePatch } from '../core/buildUpdatePatch';
import type { ExistingInventoryItem } from '../types/inventory.types';
import type { PartChange } from '../modules/importer/comparators/comparePart';
import type { PartCanonical } from '../modules/importer/schemas/part.schema';

export type ExecutionType = 'create' | 'update' | 'skip' | 'conflict' | 'invalid';

export interface ExecutionAction {
  row: number;
  type: ExecutionType;
  reason: string;
  targetId?: string;
  payload?: InventoryPersistencePayload | InventoryPersistencePatch;
}

export interface ExecutionSummary {
  executable: number;
  creates: number;
  updates: number;
  skipped: number;
  conflicts: number;
  invalid: number;
}

export interface ExecutionPlan {
  summary: ExecutionSummary;
  actions: ExecutionAction[];
}

interface BuildExecutionPlanOptions {
  storeId: string | number;
  integrationId?: string | number | null;
}

interface FinalDecision {
  row: number;
  valid: boolean;
  action?: ExecutionType;
  data?: PartCanonical;
  existingPart?: ExistingInventoryItem | null;
  changes?: PartChange[];
  reason?: string;
}

const getTargetId = (existingPart: ExistingInventoryItem | null | undefined): string | null => {
  if (!existingPart?.id) return null;
  const targetId = String(existingPart.id).trim();
  return targetId === '' ? null : targetId;
};

export const buildExecutionPlan = (
  decisions: FinalDecision[],
  options: BuildExecutionPlanOptions
): ExecutionPlan => {
  const actions: ExecutionAction[] = [];
  const summary: ExecutionSummary = {
    executable: 0,
    creates: 0,
    updates: 0,
    skipped: 0,
    conflicts: 0,
    invalid: 0,
  };

  if (!options?.storeId || String(options.storeId).trim() === '') {
    throw new Error('storeId obrigatorio para buildExecutionPlan');
  }

  if (!Array.isArray(decisions)) return { summary, actions };

  for (const decision of decisions) {
    if (!decision || typeof decision !== 'object') continue;

    if (decision.valid === false || decision.action === 'invalid') {
      actions.push({ row: decision.row, type: 'invalid', reason: decision.reason ?? 'linha invalida' });
      summary.invalid += 1;
      continue;
    }

    if (decision.action === 'create') {
      const payload = buildPersistencePayload(decision.data as PartCanonical, {
        storeId: options.storeId,
        integrationId: options.integrationId,
      });
      actions.push({ row: decision.row, type: 'create', reason: decision.reason ?? 'nova peca', payload });
      summary.creates += 1;
      continue;
    }

    if (decision.action === 'update') {
      const targetId = getTargetId(decision.existingPart);
      if (!targetId) {
        throw new Error(`targetId ausente para update na linha ${decision.row}`);
      }

      if (!decision.data) {
        throw new Error(`incomingPart ausente para update na linha ${decision.row}`);
      }

      const payload = buildUpdatePatch({
        incomingPart: decision.data,
        existingPart: decision.existingPart,
        changes: decision.changes ?? [],
        context: {
          storeId: String(options.storeId),
        },
      });
      actions.push({
        row: decision.row,
        type: 'update',
        reason: decision.reason ?? 'peca existente com alteracoes',
        targetId,
        payload,
      });
      summary.updates += 1;
      continue;
    }

    if (decision.action === 'conflict') {
      actions.push({ row: decision.row, type: 'conflict', reason: decision.reason ?? 'possivel peca duplicada' });
      summary.conflicts += 1;
      continue;
    }

    if (decision.action === 'skip') {
      actions.push({
        row: decision.row,
        type: 'skip',
        reason: decision.reason ?? 'sem alteracoes',
        targetId: getTargetId(decision.existingPart) ?? undefined,
      });
      summary.skipped += 1;
      continue;
    }
  }

  summary.executable = summary.creates + summary.updates;

  return {
    summary,
    actions,
  };
};

export default buildExecutionPlan;
