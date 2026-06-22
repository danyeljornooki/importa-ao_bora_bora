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

  it('id_int que comeca com digito vira numero e remove sufixo de letras', () => {
    const result = normalizePart({ price: 10, id_int: '1219c' });
    expect(result.id_int).toBe(1219);
    expect(result.id_string).toBeUndefined();
  });

  it('id_int 807xxxxxx permanece inteiro (nao corta prefixo)', () => {
    expect(normalizePart({ price: 10, id_int: '807216911' }).id_int).toBe(807216911);
  });

  it('id_int nao numerico vira id_string e nao id_int', () => {
    const result = normalizePart({ price: 10, id_int: 'ABC123' });
    expect(result.id_string).toBe('ABC123');
    expect(result.id_int).toBeUndefined();
  });

  it('extrai o ultimo segmento da localizacao hierarquica', () => {
    expect(normalizePart({ price: 10, location: 'GALPAO A > ESTRADA > Local 103' }).location)
      .toBe('Local 103');
  });

  it('localizacao cujo ultimo segmento e EXCLUIDO vira null', () => {
    expect(normalizePart({ price: 10, location: 'GALPAO A > EXCLUIDO' }).location)
      .toBeNull();
  });

  it('normaliza MLBs separados por barra', () => {
    expect(normalizePart({ price: 10, mlb: 'MLB123/MLB456' }).mlb_ids)
      .toEqual(['MLB123', 'MLB456']);
  });

  it('promove codigo numerico a id_int quando nao ha coluna id_int dedicada', () => {
    const result = normalizePart({ price: 10, codigo: '1219c' });
    expect(result.id_int).toBe(1219);
    expect(result.code).toBe('1219c');
  });

  it('codigo OEM nao numerico fica so em code, nao vira id_int', () => {
    const result = normalizePart({ price: 10, codigo: '5u0903025h' });
    expect(result.id_int).toBeUndefined();
    expect(result.code).toBe('5u0903025h');
  });

  it('coluna id_int dedicada tem prioridade sobre o codigo', () => {
    const result = normalizePart({ price: 10, id_int: '1219c', code: 'ABC' });
    expect(result.id_int).toBe(1219);
    expect(result.code).toBe('ABC');
  });
});
