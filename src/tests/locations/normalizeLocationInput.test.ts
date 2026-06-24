import { describe, expect, it } from 'vitest';
import { normalizeLocationInput } from '../../core/locations/normalizeLocationInput';

describe('normalizeLocationInput', () => {
  it('normaliza localizacao simples', () => {
    expect(normalizeLocationInput('PRATELEIRA A')).toMatchObject({
      normalizedText: 'PRATELEIRA A',
      parts: ['PRATELEIRA A'],
      pathKey: 'prateleira-a',
    });
  });

  it('normaliza caminho hierarquico', () => {
    expect(normalizeLocationInput('SETOR B > CAIXA 246')).toMatchObject({
      normalizedText: 'SETOR B > CAIXA 246',
      parts: ['SETOR B', 'CAIXA 246'],
      pathKey: 'setor-b/caixa-246',
    });
  });

  it('mantem localizacao compacta como um unico segmento', () => {
    expect(normalizeLocationInput(' G1   P11 A2 CX49 ')).toMatchObject({
      normalizedText: 'G1 P11 A2 CX49',
      parts: ['G1 P11 A2 CX49'],
      pathKey: 'g1-p11-a2-cx49',
    });
  });
});
