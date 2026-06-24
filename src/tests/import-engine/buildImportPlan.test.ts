import { describe, expect, it } from 'vitest';
import { buildImportPlan } from '../../modules/importer/planner/buildImportPlan';

describe('buildImportPlan', () => {
  it('mantem classificacao principal da importacao', () => {
    const plan = buildImportPlan([
      {
        row: 1,
        valid: true,
        action: 'create',
        changed: true,
        totalChanges: 0,
        changes: [],
        errors: [],
        warnings: [],
        data: { code: 'P-1', price: 10, stock_quantity: 1 },
      },
      {
        row: 2,
        valid: true,
        action: 'update',
        changed: false,
        totalChanges: 0,
        changes: [],
        matchedBy: 'code',
        errors: [],
        warnings: [],
        data: { code: 'P-2', price: 10, stock_quantity: 1 },
      },
      {
        row: 3,
        valid: false,
        action: 'skip',
        changed: false,
        totalChanges: 0,
        changes: [],
        errors: ['price obrigatório'],
        warnings: [],
      },
    ]);

    expect(plan.summary).toMatchObject({
      total: 3,
      creates: 1,
      skipped: 1,
      invalid: 1,
    });
    expect(plan.actions.map((action) => action.type)).toEqual([
      'create',
      'skip',
      'invalid',
    ]);
  });
});
