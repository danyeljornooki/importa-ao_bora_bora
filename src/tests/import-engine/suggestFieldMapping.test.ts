import { describe, expect, it } from 'vitest';
import { suggestFieldMapping, applyColumnMapping } from '../../modules/importer/suggestFieldMapping';
import { normalizePart } from '../../modules/importer/normalizePart';

const headerFor = (result: ReturnType<typeof suggestFieldMapping>, field: string) =>
  result.suggestions.find((s) => s.field === field);

describe('suggestFieldMapping', () => {
  it('casa cabecalho por alias exato (apos normalizar acento/caixa)', () => {
    const result = suggestFieldMapping(['Preço', 'Descrição']);
    const price = headerFor(result, 'price');
    expect(price?.header).toBe('Preço');
    expect(price?.matchedBy).toBe('alias');
    expect(price?.score).toBe(1);
  });

  it('casa cabecalho parecido por similaridade quando nao ha alias exato', () => {
    // "Codigo Produto" -> contem "codigo"/"numeroproduto" -> code
    const result = suggestFieldMapping(['Codigo Produto']);
    const code = headerFor(result, 'code');
    expect(code?.header).toBe('Codigo Produto');
    expect(code?.matchedBy).toBe('similarity');
    expect(code?.score).toBeGreaterThanOrEqual(0.5);
  });

  it('associa varios cabecalhos bagunçados aos campos certos', () => {
    const result = suggestFieldMapping([
      'Qtd Estoque',
      'Valor',
      'Titulo ML',
      'Localizacao',
    ]);
    expect(headerFor(result, 'stock_quantity')?.header).toBe('Qtd Estoque');
    expect(headerFor(result, 'price')?.header).toBe('Valor');
    expect(headerFor(result, 'title')?.header).toBe('Titulo ML');
    expect(headerFor(result, 'location')?.header).toBe('Localizacao');
  });

  it('cabecalho sem correspondencia fica em unmappedHeaders', () => {
    const result = suggestFieldMapping(['Coluna Aleatoria XPTO', 'Preço']);
    expect(result.unmappedHeaders).toContain('Coluna Aleatoria XPTO');
    expect(result.unmappedHeaders).not.toContain('Preço');
  });

  it('nao usa o mesmo cabecalho para dois campos', () => {
    const result = suggestFieldMapping(['preco']);
    const mapped = result.suggestions.filter((s) => s.header === 'preco');
    expect(mapped.length).toBe(1);
  });

  it('campo sem cabecalho correspondente vem com header null', () => {
    const result = suggestFieldMapping(['Preço']);
    const description = headerFor(result, 'description');
    expect(description?.header).toBeNull();
    expect(description?.matchedBy).toBe('none');
  });

  it('respeita o limiar configuravel', () => {
    const low = suggestFieldMapping(['Cod'], { threshold: 0.3 });
    const high = suggestFieldMapping(['Cod'], { threshold: 0.95 });
    expect(headerFor(low, 'code')?.header).toBe('Cod');
    expect(headerFor(high, 'code')?.header).toBeNull();
  });
});

describe('applyColumnMapping', () => {
  it('roteia uma coluna de nome arbitrario pro campo certo (via normalizePart)', () => {
    const row = { 'Cod. Interno XYZ': '1219c', 'Vlr': '149,90' };
    const mapped = applyColumnMapping(row, { code: 'Cod. Interno XYZ', price: 'Vlr' });
    const part = normalizePart(mapped);
    expect(part.code).toBe('1219c');
    expect(part.id_int).toBe(1219); // promovido pelo code->id_int
    expect(part.price).toBe(149.9);
  });

  it('sem mapeamento, retorna a linha inalterada', () => {
    const row = { codigo: '123' };
    expect(applyColumnMapping(row)).toBe(row);
  });

  it('ignora mapeamento para coluna inexistente', () => {
    const row = { codigo: '123' };
    const mapped = applyColumnMapping(row, { price: 'Coluna Que Nao Existe' });
    expect(mapped).toEqual({ codigo: '123' });
  });
});
