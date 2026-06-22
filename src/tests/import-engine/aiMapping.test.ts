import { describe, expect, it } from 'vitest';
import { sanitizeAiMapping } from '../../adapters/ai/openAiMappingAdapter';

describe('sanitizeAiMapping', () => {
  const headers = ['Cod Interno', 'Valor', 'Nome'];

  it('aceita campos validos com coluna existente', () => {
    const result = sanitizeAiMapping(
      { mapping: { code: 'Cod Interno', price: 'Valor', title: 'Nome' } },
      headers
    );
    expect(result).toEqual({ code: 'Cod Interno', price: 'Valor', title: 'Nome' });
  });

  it('descarta coluna inventada pela IA (alucinacao)', () => {
    const result = sanitizeAiMapping({ mapping: { code: 'Coluna Fantasma' } }, headers);
    expect(result.code).toBeUndefined();
  });

  it('descarta campo canonico desconhecido', () => {
    const result = sanitizeAiMapping({ mapping: { campo_invalido: 'Valor' } }, headers);
    expect(result).toEqual({});
  });

  it('aceita objeto sem a chave mapping (formato alternativo)', () => {
    const result = sanitizeAiMapping({ code: 'Cod Interno' }, headers);
    expect(result.code).toBe('Cod Interno');
  });

  it('entrada invalida vira objeto vazio', () => {
    expect(sanitizeAiMapping(null, headers)).toEqual({});
    expect(sanitizeAiMapping('texto', headers)).toEqual({});
  });
});
