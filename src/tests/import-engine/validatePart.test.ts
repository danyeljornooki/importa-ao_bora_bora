import { describe, expect, it } from 'vitest';
import { validatePart } from '../../modules/importer/validators/validatePart';
import type { PartCanonical } from '../../modules/importer/schemas/part.schema';

const validPart = (): PartCanonical => ({
  code: 'P-1',
  title: 'Peca',
  price: 10,
  stock_quantity: 1,
  description: 'Descricao',
  location: 'A1',
});

describe('validatePart', () => {
  it('aceita code, title, price e stock validos', () => {
    expect(validatePart(validPart()).valid).toBe(true);
  });

  it('rejeita price ausente', () => {
    const result = validatePart({
      ...validPart(),
      price: undefined as unknown as number,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('price obrigatório');
  });

  it('rejeita price negativo', () => {
    const result = validatePart({ ...validPart(), price: -1 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('price deve ser >= 0');
  });

  it('avisa quando descricao esta ausente', () => {
    const result = validatePart({ ...validPart(), description: undefined });
    expect(result.warnings).toContain('description ausente');
  });

  it('avisa quando localizacao esta ausente', () => {
    const result = validatePart({ ...validPart(), location: null });
    expect(result.warnings).toContain('location ausente');
  });
});
