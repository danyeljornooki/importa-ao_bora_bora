import { describe, expect, it } from 'vitest';
import { normalizePart } from '../../modules/importer/normalizePart';

describe('normalizePart', () => {
  it.each([
    ['2.910,00', 2910],
    ['57,58', 57.58],
  ])('normaliza preco brasileiro %s', (value, expected) => {
    expect(normalizePart({ price: value }).price).toBe(expected);
  });

  it('aplica regra especial de quantidade disponivel', () => {
    const result = normalizePart({
      price: 10,
      quantidade_disponivel: '1.000',
    });

    expect(result.stock_quantity).toBe(1);
  });

  it('normaliza MLBs separados por virgula e ponto e virgula', () => {
    const result = normalizePart({
      price: 10,
      mlb: 'MLB123, MLB456;MLB789',
    });

    expect(result.mlb_ids).toEqual(['MLB123', 'MLB456', 'MLB789']);
  });

  it('converte localizacao excluido para null', () => {
    expect(normalizePart({ price: 10, location: 'excluído' }).location)
      .toBeNull();
  });

  it('normaliza imagem unica', () => {
    expect(normalizePart({
      price: 10,
      imagem: 'https://example.com/a.jpg',
    }).image_urls).toEqual(['https://example.com/a.jpg']);
  });

  it('normaliza multiplas URLs de imagem', () => {
    expect(normalizePart({
      price: 10,
      imagens: 'https://example.com/a.jpg; https://example.com/b.jpg',
    }).image_urls).toEqual([
      'https://example.com/a.jpg',
      'https://example.com/b.jpg',
    ]);
  });
});
