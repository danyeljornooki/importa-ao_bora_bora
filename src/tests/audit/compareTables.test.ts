import { describe, expect, it } from 'vitest';
import { compareTables } from '../../modules/audit/compareTables';

describe('compareTables', () => {
  const A = [
    { cod: '1234C', preco: '149,90', nome: 'Farol' },
    { cod: '9999', preco: '10', nome: 'Lanterna' },
    { cod: '5555', preco: '20', nome: 'Capô' },
  ];
  const B = [
    { id_int: '1234', valor: '149,90', titulo: 'Farol' },
    { id_int: '9999', valor: '12', titulo: 'Lanterna' },
    { id_int: '7777', valor: '30', titulo: 'Porta' },
  ];

  it('casa por chave com tratamento digits e classifica', () => {
    const result = compareTables(A, B, {
      keyA: 'cod',
      keyB: 'id_int',
      keyTransform: 'digits',
      fields: [{ label: 'Preço', colA: 'preco', colB: 'valor' }],
    });
    // 1234 e 9999 casam; 5555 só em A; 7777 só em B
    expect(result.summary.onlyInA).toBe(1); // 5555
    expect(result.summary.onlyInB).toBe(1); // 7777
    // 1234: preço igual -> matched; 9999: preço difere (10 vs 12) -> divergent
    expect(result.summary.matched).toBe(1);
    expect(result.summary.divergent).toBe(1);
    expect(result.divergent[0].key).toBe('9999');
    expect(result.divergent[0].differences?.[0].label).toBe('Preço');
  });

  it('sem tratamento, "1234C" não casa com "1234"', () => {
    const result = compareTables(A, B, { keyA: 'cod', keyB: 'id_int' });
    expect(result.summary.matched + result.summary.divergent).toBe(1); // só 9999
  });

  it('sem campos configurados, pares casados sao todos matched', () => {
    const result = compareTables(A, B, { keyA: 'cod', keyB: 'id_int', keyTransform: 'digits' });
    expect(result.summary.divergent).toBe(0);
    expect(result.summary.matched).toBe(2); // 1234 e 9999
  });

  it('matchRate reflete % de A encontrada em B', () => {
    const result = compareTables(A, B, { keyA: 'cod', keyB: 'id_int', keyTransform: 'digits' });
    // 2 de 3 chaves de A casaram -> 66.7%
    expect(result.summary.matchRate).toBeCloseTo(66.7, 1);
  });

  it('comparacao de campo respeita o tratamento do campo', () => {
    const a = [{ k: '1', nome: 'Capô' }];
    const b = [{ k: '1', nome: 'CAPO' }];
    const semText = compareTables(a, b, { keyA: 'k', keyB: 'k', fields: [{ label: 'Nome', colA: 'nome', colB: 'nome' }] });
    expect(semText.summary.divergent).toBe(1);
    const comText = compareTables(a, b, { keyA: 'k', keyB: 'k', fields: [{ label: 'Nome', colA: 'nome', colB: 'nome', transform: 'text' }] });
    expect(comText.summary.divergent).toBe(0);
  });
});
