import { describe, expect, it } from 'vitest';
import {
  normalizeForCompare,
  crossColumnLookup,
  findDuplicateRows,
} from '../../modules/importer/diagnostics';

describe('normalizeForCompare', () => {
  it('digits remove letras e simbolos', () => {
    expect(normalizeForCompare('1234C', 'digits')).toBe('1234');
    expect(normalizeForCompare('AB-12', 'digits')).toBe('12');
  });
  it('text remove acentos e baixa caixa', () => {
    expect(normalizeForCompare('Capô Frontal', 'text')).toBe('capo frontal');
  });
  it('none so faz trim+lowercase', () => {
    expect(normalizeForCompare('  AbC ', 'none')).toBe('abc');
  });
});

describe('crossColumnLookup', () => {
  it('acha valores da coluna A que aparecem na coluna B', () => {
    const a = [{ cod_peca: '1234C' }, { cod_peca: '9999' }];
    const b = [{ id_int: '1234' }, { id_int: '5555' }];
    const result = crossColumnLookup(a, 'cod_peca', b, 'id_int', 'digits');
    expect(result.totalMatched).toBe(1);
    expect(result.matches[0].value).toBe('1234');
    expect(result.matches[0].rowsA).toEqual([1]);
    expect(result.matches[0].rowsB).toEqual([1]);
  });

  it('sem tratamento, "1234C" nao casa com "1234"', () => {
    const a = [{ cod: '1234C' }];
    const b = [{ id: '1234' }];
    expect(crossColumnLookup(a, 'cod', b, 'id', 'none').totalMatched).toBe(0);
  });

  it('casa nome de coluna tolerante a acento/caixa', () => {
    const a = [{ 'Código': '10' }];
    const b = [{ id_int: '10' }];
    expect(crossColumnLookup(a, 'codigo', b, 'id_int').totalMatched).toBe(1);
  });
});

describe('findDuplicateRows', () => {
  it('encontra valores repetidos e ordena por tamanho do grupo', () => {
    const rows = [
      { id: '807210525' },
      { id: '807210515' },
      { id: '807210525' },
      { id: '807210525' },
      { id: '807210515' },
    ];
    const result = findDuplicateRows(rows, 'id');
    expect(result.totalGroups).toBe(2);
    expect(result.totalRows).toBe(5);
    expect(result.duplicates[0].value).toBe('807210525');
    expect(result.duplicates[0].rows).toEqual([1, 3, 4]);
    expect(result.duplicates[1].rows).toEqual([2, 5]);
  });

  it('valores unicos nao geram duplicata', () => {
    const rows = [{ id: '1' }, { id: '2' }];
    expect(findDuplicateRows(rows, 'id').totalGroups).toBe(0);
  });

  it('aplica tratamento antes de agrupar', () => {
    const rows = [{ cod: '1234C' }, { cod: '1234' }];
    expect(findDuplicateRows(rows, 'cod', 'digits').totalGroups).toBe(1);
  });
});
