import { describe, expect, it } from 'vitest';
import { firstPictureUrl, parseAdPictures } from '../../features/catalog-preview/parseAdPictures';

describe('parseAdPictures', () => {
  it('aceita pictures como string JSON', () => {
    const result = parseAdPictures('[{"url":"https://example.com/a.jpg"}]');
    expect(result).toEqual([{ url: 'https://example.com/a.jpg' }]);
  });

  it('aceita pictures como array', () => {
    const result = parseAdPictures([{ secure_url: 'https://secure.example.com/a.jpg' }]);
    expect(result).toEqual([{ secure_url: 'https://secure.example.com/a.jpg' }]);
  });

  it('pictures invalido retorna array vazio', () => {
    expect(parseAdPictures('{')).toEqual([]);
    expect(parseAdPictures(null)).toEqual([]);
    expect(parseAdPictures({ url: 'x' })).toEqual([]);
  });

  it('secure_url tem prioridade', () => {
    expect(firstPictureUrl([
      { url: 'https://example.com/a.jpg', secure_url: 'https://secure.example.com/a.jpg' },
    ])).toBe('https://secure.example.com/a.jpg');
  });

  it('usa fallback para url', () => {
    expect(firstPictureUrl([{ url: 'https://example.com/a.jpg' }])).toBe('https://example.com/a.jpg');
  });
});
