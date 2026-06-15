import { describe, expect, it } from 'vitest';
import { fromPartCanonical } from '../../domain/part/mappers/fromPartCanonical';
import { toMongoInventoryShape } from '../../domain/part/mappers/toMongoInventoryShape';
import { toSupabaseInventoryShape } from '../../domain/part/mappers/toSupabaseInventoryShape';
import { validateCanonicalPart } from '../../domain/part/validateCanonicalPart';

const canonicalPart = () => fromPartCanonical({
  storeId: 'store-1',
  part: {
    id_int: 10,
    code: 'P-1',
    title: 'Peca',
    price: 10,
    stock_quantity: 1,
    image_urls: ['https://example.com/a.jpg'],
    mlb_ids: ['MLB123'],
  },
});

describe('CanonicalPart', () => {
  it('fromPartCanonical gera CanonicalPart valido', () => {
    expect(validateCanonicalPart(canonicalPart()).valid).toBe(true);
  });

  it('detecta price invalido', () => {
    const part = canonicalPart();
    part.commercial.price = -1;
    expect(validateCanonicalPart(part).valid).toBe(false);
  });

  it('SupabaseInventoryShape gera imagens como objeto', () => {
    expect(toSupabaseInventoryShape(canonicalPart()).images).toEqual([{
      url: 'https://example.com/a.jpg',
      thumbnail_url: 'https://example.com/a.jpg',
      source: 'sheet',
      ordem: 0,
    }]);
  });

  it('MongoInventoryShape gera imagens como objeto', () => {
    expect(toMongoInventoryShape(canonicalPart()).images).toEqual([{
      url: 'https://example.com/a.jpg',
      thumbnail_url: 'https://example.com/a.jpg',
      source: 'sheet',
      ordem: 0,
    }]);
  });
});
