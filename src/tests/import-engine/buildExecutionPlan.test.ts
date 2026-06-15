import { describe, expect, it } from 'vitest';
import { buildExecutionPlan } from '../../planners/buildExecutionPlan';
import type { PartCanonical } from '../../modules/importer/schemas/part.schema';
import type { ExistingInventoryItem } from '../../types/inventory.types';

const part: PartCanonical = {
  code: 'P-1',
  title: 'Peca',
  price: 10,
  stock_quantity: 1,
  description: 'Descricao',
};
const existing: ExistingInventoryItem = {
  id: 'item-1',
  store_id: 'store-1',
  code: 'P-1',
  price: 5,
  stock_quantity: 1,
};

describe('buildExecutionPlan', () => {
  it('create gera payload completo', () => {
    const action = buildExecutionPlan(
      [{ row: 1, valid: true, action: 'create', data: part }],
      { storeId: 'store-1' }
    ).actions[0];
    expect(action.payload).toMatchObject({
      store_id: 'store-1',
      code: 'P-1',
      images: [],
      catalog_attributes: [],
    });
  });

  it('update gera patch e nao payload completo', () => {
    const action = buildExecutionPlan(
      [{
        row: 1,
        valid: true,
        action: 'update',
        data: part,
        existingPart: existing,
        changes: [{ field: 'price', oldValue: 5, newValue: 10 }],
      }],
      { storeId: 'store-1' }
    ).actions[0];
    expect(action.payload).toEqual({ price: 10, marketplace_price: 10 });
  });

  it.each(['skip', 'conflict', 'invalid'] as const)(
    '%s nao gera payload executavel',
    (actionType) => {
      const action = buildExecutionPlan(
        [{
          row: 1,
          valid: actionType !== 'invalid',
          action: actionType,
          data: part,
          existingPart: existing,
        }],
        { storeId: 'store-1' }
      ).actions[0];
      expect(action.payload).toBeUndefined();
    }
  );
});
