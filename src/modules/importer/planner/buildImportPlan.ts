import type { PartCanonical } from '../schemas/part.schema';
import type { PartChange } from '../comparators/comparePart';

export type ImportActionType = 'create' | 'update' | 'skip' | 'conflict' | 'invalid';

export interface ImportAction {
  row: number;
  type: ImportActionType;
  reason: string;
  data?: PartCanonical;
  changes?: PartChange[];
  matchedBy?: 'id_int' | 'code' | 'mlb_id' | 'title' | null;
  confidence?: number;
}

export interface ImportPlanSummary {
  total: number;
  creates: number;
  updates: number;
  unchangedUpdates: number;
  conflicts: number;
  skipped: number;
  invalid: number;
}

export interface ImportPlan {
  summary: ImportPlanSummary;
  actions: ImportAction[];
}

interface PreviewItem {
  row: number;
  valid: boolean;
  action?: 'create' | 'update' | 'conflict' | 'skip';
  matchedBy?: 'id_int' | 'code' | 'mlb_id' | 'title' | null;
  confidence?: number;
  changed: boolean;
  totalChanges: number;
  changes: PartChange[];
  data?: PartCanonical;
  errors: string[];
  warnings: string[];
}

export const buildImportPlan = (previewItems: PreviewItem[]): ImportPlan => {
  const actions: ImportAction[] = [];
  const summary: ImportPlanSummary = {
    total: previewItems.length,
    creates: 0,
    updates: 0,
    unchangedUpdates: 0,
    conflicts: 0,
    skipped: 0,
    invalid: 0,
  };

  if (!Array.isArray(previewItems)) {
    return { summary, actions };
  }

  for (const item of previewItems) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    if (item.valid === false) {
      actions.push({
        row: item.row,
        type: 'invalid',
        reason: 'linha inválida',
      });
      summary.invalid += 1;
      continue;
    }

    if (item.action === 'create') {
      actions.push({
        row: item.row,
        type: 'create',
        reason: 'nova peça',
        data: item.data,
      });
      summary.creates += 1;
      continue;
    }

    if (item.action === 'update' && item.changed === true) {
      actions.push({
        row: item.row,
        type: 'update',
        reason: 'peça existente com alterações',
        data: item.data,
        changes: item.changes,
        matchedBy: item.matchedBy,
        confidence: item.confidence,
      });
      summary.updates += 1;
      continue;
    }

    if (item.action === 'update' && item.changed === false) {
      actions.push({
        row: item.row,
        type: 'skip',
        reason: 'sem alterações',
      });
      summary.unchangedUpdates += 1;
      summary.skipped += 1;
      continue;
    }

    if (item.action === 'conflict') {
      actions.push({
        row: item.row,
        type: 'conflict',
        reason: 'possível peça duplicada',
      });
      summary.conflicts += 1;
      continue;
    }

  if (item.action === 'skip') {
      actions.push({
        row: item.row,
        type: 'skip',
        reason: item.matchedBy ? 'sem alteraÃ§Ãµes' : 'linha ignorada',
      });
      if (item.matchedBy) {
        summary.unchangedUpdates += 1;
      }
      summary.skipped += 1;
      continue;
    }
  }

  return {
    summary,
    actions,
  };
};
