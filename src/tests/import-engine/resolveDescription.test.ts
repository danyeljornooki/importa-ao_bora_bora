import { describe, expect, it } from 'vitest';
import { resolveDescription } from '../../modules/importer/resolveDescription';

describe('resolveDescription', () => {
  const sources = { sheet: 'descrição da planilha', ml: 'descrição do anúncio ML' };

  it("'sheet' usa sempre a da planilha", () => {
    expect(resolveDescription(sources, 'sheet')).toBe('descrição da planilha');
  });

  it("'ml' usa sempre a do anúncio", () => {
    expect(resolveDescription(sources, 'ml')).toBe('descrição do anúncio ML');
  });

  it("'sheet_then_ml' usa a do ML quando a planilha está vazia", () => {
    expect(resolveDescription({ sheet: '', ml: 'do ML' }, 'sheet_then_ml')).toBe('do ML');
    expect(resolveDescription({ sheet: '  ', ml: 'do ML' }, 'sheet_then_ml')).toBe('do ML');
    expect(resolveDescription({ sheet: 'da planilha', ml: 'do ML' }, 'sheet_then_ml')).toBe('da planilha');
  });

  it("'ml_then_sheet' usa a da planilha quando o ML está vazio", () => {
    expect(resolveDescription({ sheet: 'da planilha', ml: null }, 'ml_then_sheet')).toBe('da planilha');
    expect(resolveDescription({ sheet: 'da planilha', ml: 'do ML' }, 'ml_then_sheet')).toBe('do ML');
  });

  it('padrão é sheet_then_ml', () => {
    expect(resolveDescription({ sheet: null, ml: 'do ML' })).toBe('do ML');
    expect(resolveDescription({ sheet: 'da planilha', ml: 'do ML' })).toBe('da planilha');
  });

  it('retorna null quando nenhuma fonte existe', () => {
    expect(resolveDescription({ sheet: null, ml: null }, 'sheet_then_ml')).toBeNull();
    expect(resolveDescription({ sheet: '', ml: '' }, 'ml')).toBeNull();
  });
});
