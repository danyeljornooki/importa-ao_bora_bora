import { describe, expect, it } from 'vitest';
import { comparePart } from '../../modules/importer/comparators/comparePart';
import type { PartCanonical } from '../../modules/importer/schemas/part.schema';

const base = (): PartCanonical => ({
  code: 'P-1',
  title: 'Peca',
  price: 10,
  stock_quantity: 1,
  description: 'Descricao',
  location: 'A1',
  id_int: 10,
  mlb_ids: ['MLB1', 'MLB2'],
  image_urls: ['https://example.com/a', 'https://example.com/b'],
});

describe('comparePart', () => {
  it.each([
    ['price', 20],
    ['stock_quantity', 2],
    ['description', 'Nova descricao'],
    ['location', 'B2'],
  ] as const)('detecta alteracao em %s', (field, value) => {
    const imported = { ...base(), [field]: value };
    const result = comparePart(imported, base());
    expect(result.changes.map((change) => change.field)).toContain(field);
  });

  it('nao gera falso update para id_int number vs string', () => {
    expect(comparePart(base(), { ...base(), id_int: '10' }).changed).toBe(false);
  });

  it('considera arrays iguais em ordem diferente', () => {
    const imported = {
      ...base(),
      mlb_ids: ['MLB2', 'MLB1'],
      image_urls: ['https://example.com/b', 'https://example.com/a'],
    };
    expect(comparePart(imported, base()).changed).toBe(false);
  });
});
