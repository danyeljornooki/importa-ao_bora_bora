import { describe, expect, it } from 'vitest';
import { parseSpreadsheetFile } from '../../core/files/parseSpreadsheetFile';

describe('parseSpreadsheetFile', () => {
  it('parseia CSV com virgula', async () => {
    const result = await parseSpreadsheetFile(
      Buffer.from('codigo,nome\nP-1,Filtro\nP-2,Farol'),
      { fileName: 'pecas.csv' }
    );

    expect(result).toMatchObject({
      columns: ['codigo', 'nome'],
      totalRows: 2,
      fileType: 'csv',
      sheetName: null,
    });
    expect(result.rows[0]).toEqual({ codigo: 'P-1', nome: 'Filtro' });
  });

  it('parseia CSV com ponto e virgula', async () => {
    const result = await parseSpreadsheetFile(
      Buffer.from('codigo;nome\nP-1;Filtro'),
      { fileName: 'pecas.csv' }
    );

    expect(result.columns).toEqual(['codigo', 'nome']);
    expect(result.rows[0]).toEqual({ codigo: 'P-1', nome: 'Filtro' });
  });

  it('preserva valores como string', async () => {
    const result = await parseSpreadsheetFile(
      Buffer.from('codigo,preco,estoque\n00123,"149,90",05'),
      { fileName: 'pecas.csv' }
    );

    expect(result.rows[0]).toEqual({
      codigo: '00123',
      preco: '149,90',
      estoque: '05',
    });
  });

  it('detecta colunas e total de linhas', async () => {
    const result = await parseSpreadsheetFile(
      Buffer.from('\nCodigo,Descricao\nA,Amortecedor\n'),
      { fileName: 'pecas.csv' }
    );

    expect(result.columns).toEqual(['Codigo', 'Descricao']);
    expect(result.totalRows).toBe(1);
  });

  it('rejeita arquivo com tipo invalido com erro claro', async () => {
    await expect(parseSpreadsheetFile(
      Buffer.from('codigo,nome\nP-1,Filtro'),
      { fileName: 'pecas.txt' }
    )).rejects.toThrow('Tipo de arquivo inválido');
  });

  it('rejeita CSV sem colunas com erro claro', async () => {
    await expect(parseSpreadsheetFile(
      Buffer.from('\n\n'),
      { fileName: 'pecas.csv' }
    )).rejects.toThrow('nenhuma coluna foi encontrada');
  });
});
