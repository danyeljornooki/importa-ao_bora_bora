import { describe, expect, it } from 'vitest';
import { matchPart } from '../../modules/importer/matchers/matchPart';
import type { PartCanonical } from '../../modules/importer/schemas/part.schema';
import type { ExistingInventoryItem } from '../../types/inventory.types';

const incoming = (overrides: Partial<PartCanonical> = {}): PartCanonical => ({
  code: 'NEW',
  title: 'Peca nova',
  price: 10,
  stock_quantity: 1,
  ...overrides,
});

const existing = (
  overrides: Partial<ExistingInventoryItem> = {}
): ExistingInventoryItem => ({
  id: 'item-1',
  store_id: 'store-1',
  id_int: 10,
  code: 'CODE-1',
  id_string: 'MLB123',
  marketplace_name: 'Farol dianteiro direito',
  deleted: false,
  ...overrides,
});

describe('matchPart', () => {
  it('prioriza id_int sobre outros identificadores', () => {
    const result = matchPart(
      incoming({ id_int: 10, code: 'OTHER', mlb_ids: ['MLB999'] }),
      [existing()]
    );
    expect(result.matchedBy).toBe('id_int');
  });

  it('usa code como fallback', () => {
    expect(matchPart(incoming({ code: 'CODE-1' }), [existing()]).matchedBy)
      .toBe('code');
  });

  it('usa MLB/id_string como fallback', () => {
    expect(matchPart(
      incoming({ code: 'OTHER', mlb_ids: ['MLB123'] }),
      [existing()]
    ).matchedBy).toBe('mlb_id');
  });

  it('titulo igual gera conflict', () => {
    const result = matchPart(
      incoming({ code: 'OTHER', title: 'Farol dianteiro direito' }),
      [existing()]
    );
    expect(result.action).toBe('conflict');
    expect(result.matchedBy).toBe('title');
  });

  it('titulo parecido gera warning e create', () => {
    const result = matchPart(
      incoming({ code: 'OTHER', title: 'Farol dianteiro direito original' }),
      [existing()]
    );
    expect(result.action).toBe('create');
    expect(result.titleMatch).toBe('similar');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('ignora item com status deleted', () => {
    const result = matchPart(
      incoming({ id_int: 10, code: 'CODE-1', mlb_ids: ['MLB123'] }),
      [existing({ status: 'deleted' })]
    );
    expect(result.action).toBe('create');
  });
});
