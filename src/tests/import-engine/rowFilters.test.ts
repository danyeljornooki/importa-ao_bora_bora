import { describe, expect, it } from 'vitest';
import { evaluateRowFilters, type RowFilterRule } from '../../modules/importer/rowFilters';

describe('evaluateRowFilters', () => {
  it('sem regras, nunca exclui', () => {
    expect(evaluateRowFilters({ codigo: 'EXCLUIDO' }, []).excluded).toBe(false);
    expect(evaluateRowFilters({ codigo: 'EXCLUIDO' }).excluded).toBe(false);
  });

  it('regra equals exclui EXCLUIDO ignorando caixa e acento', () => {
    const rules: RowFilterRule[] = [{ column: 'codigo', condition: 'equals', value: 'excluido' }];
    expect(evaluateRowFilters({ codigo: 'EXCLUÍDO' }, rules).excluded).toBe(true);
    expect(evaluateRowFilters({ codigo: 'Excluido' }, rules).excluded).toBe(true);
    expect(evaluateRowFilters({ codigo: '1219c' }, rules).excluded).toBe(false);
  });

  it('regra isEmpty exclui linha sem codigo', () => {
    const rules: RowFilterRule[] = [{ column: 'codigo', condition: 'isEmpty' }];
    expect(evaluateRowFilters({ codigo: '' }, rules).excluded).toBe(true);
    expect(evaluateRowFilters({ codigo: '   ' }, rules).excluded).toBe(true);
    expect(evaluateRowFilters({}, rules).excluded).toBe(true);
    expect(evaluateRowFilters({ codigo: '123' }, rules).excluded).toBe(false);
  });

  it('casa o nome da coluna de forma tolerante a acento/caixa', () => {
    const rules: RowFilterRule[] = [{ column: 'codigo', condition: 'isNotEmpty' }];
    expect(evaluateRowFilters({ 'Código': '123' }, rules).excluded).toBe(true);
  });

  it('regra contains', () => {
    const rules: RowFilterRule[] = [{ column: 'status', condition: 'contains', value: 'inativ' }];
    expect(evaluateRowFilters({ status: 'Produto Inativo' }, rules).excluded).toBe(true);
    expect(evaluateRowFilters({ status: 'Ativo' }, rules).excluded).toBe(false);
  });

  it('primeira regra que casa exclui e informa o motivo', () => {
    const rules: RowFilterRule[] = [
      { column: 'codigo', condition: 'isEmpty' },
      { column: 'codigo', condition: 'equals', value: 'EXCLUIDO' },
    ];
    const result = evaluateRowFilters({ codigo: 'EXCLUIDO' }, rules);
    expect(result.excluded).toBe(true);
    expect(result.matchedRule?.condition).toBe('equals');
    expect(result.reason).toContain('EXCLUIDO');
  });
});
