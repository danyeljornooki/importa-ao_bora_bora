import { describe, expect, it } from 'vitest';
import { buildUpdatePatch } from '../../core/buildUpdatePatch';
import type { PartCanonical } from '../../modules/importer/schemas/part.schema';
import type { ExistingInventoryItem } from '../../types/inventory.types';

const incoming = (): PartCanonical => ({
  code: 'P-1',
  title: 'Peca',
  price: 20,
  stock_quantity: 0,
  description: 'Nova descricao',
  location: 'A 1',
  image_urls: ['https://example.com/a'],
});
const existing: ExistingInventoryItem = {
  id: 'item-1',
  store_id: 'store-1',
};
const patch = (field: string) =>
  buildUpdatePatch({
    incomingPart: incoming(),
    existingPart: existing,
    changes: [{ field, oldValue: null, newValue: null }],
    context: { storeId: 'store-1' },
  });

describe('buildUpdatePatch', () => {
  it('preco envia somente price e marketplace_price', () => {
    expect(patch('price')).toEqual({ price: 20, marketplace_price: 20 });
  });

  it('estoque envia stock_quantity e status', () => {
    expect(patch('stock_quantity')).toEqual({
      stock_quantity: 0,
      status: 'SEM_ESTOQUE',
    });
  });

  it('descricao envia somente description', () => {
    expect(patch('description')).toEqual({ description: 'Nova descricao' });
  });

  it('localizacao envia nome e id quando aplicavel', () => {
    expect(patch('location')).toEqual({
      storage_location_name: 'A 1',
      storage_location_id: 'A 1',
    });
  });

  it('nao envia complementos por default', () => {
    const result = patch('price');
    expect(result).not.toHaveProperty('images');
    expect(result).not.toHaveProperty('catalog_attributes');
    expect(result).not.toHaveProperty('integrations');
  });
});
