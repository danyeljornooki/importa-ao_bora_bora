import type { RawPartRow } from './schemas/part.schema';

/**
 * Ferramentas de DIAGNOSTICO de planilha (cliente-agnosticas).
 *
 * Quando chega um cliente novo, antes de mapear/importar, e util investigar os
 * dados crus: descobrir se um valor de uma coluna aparece em OUTRA coluna (dado
 * na coluna errada) e encontrar valores duplicados numa coluna. Modulo PURO.
 *
 * Reaproveita a mesma ideia de "tratamento" do comparador: normalizar o valor
 * antes de comparar (so dígitos, sem acento, etc.), pra casar "1234C" com "1234".
 */

export type ValueTransform = 'none' | 'digits' | 'letters' | 'alphanumeric' | 'text';

const stripAccents = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Aplica o tratamento e normaliza (trim + lowercase) pra comparacao. */
export const normalizeForCompare = (value: unknown, transform: ValueTransform = 'none'): string => {
  if (value === null || value === undefined) return '';
  let str = String(value);
  switch (transform) {
    case 'digits':
      str = str.replace(/[^0-9]/g, '');
      break;
    case 'letters':
      str = str.replace(/[^a-zA-ZÀ-ÿ]/g, '');
      break;
    case 'alphanumeric':
      str = str.replace(/[^a-zA-Z0-9À-ÿ]/g, '');
      break;
    case 'text':
      str = stripAccents(str).replace(/\s+/g, ' ');
      break;
    default:
      break;
  }
  return str.trim().toLowerCase();
};

const normalizeHeader = (value: string): string =>
  stripAccents(String(value)).toLowerCase().trim();

const findColumnValue = (row: RawPartRow, column: string): unknown => {
  const target = normalizeHeader(column);
  for (const key of Object.keys(row)) {
    if (normalizeHeader(key) === target) return row[key];
  }
  return undefined;
};

// ─── Cruzamento de colunas ─────────────────────────────────────────────

export interface CrossColumnMatch {
  /** Valor normalizado que apareceu nos dois lados. */
  value: string;
  /** Linhas (1-based) da tabela A onde a coluna A tem esse valor. */
  rowsA: number[];
  /** Linhas (1-based) da tabela B onde a coluna B tem esse valor. */
  rowsB: number[];
}

export interface CrossColumnResult {
  matches: CrossColumnMatch[];
  /** Quantos valores distintos cruzaram. */
  totalMatched: number;
}

/**
 * Procura valores da coluna `columnA` (tabela A) que aparecem na coluna `columnB`
 * (tabela B). Util pra detectar dado na coluna errada — ex: cod_peca (cliente)
 * que vazou pra id_int (sistema).
 */
export const crossColumnLookup = (
  rowsA: RawPartRow[],
  columnA: string,
  rowsB: RawPartRow[],
  columnB: string,
  transform: ValueTransform = 'none'
): CrossColumnResult => {
  const indexA = new Map<string, number[]>();
  rowsA.forEach((row, i) => {
    const v = normalizeForCompare(findColumnValue(row, columnA), transform);
    if (!v) return;
    (indexA.get(v) ?? indexA.set(v, []).get(v)!).push(i + 1);
  });

  const indexB = new Map<string, number[]>();
  rowsB.forEach((row, i) => {
    const v = normalizeForCompare(findColumnValue(row, columnB), transform);
    if (!v) return;
    (indexB.get(v) ?? indexB.set(v, []).get(v)!).push(i + 1);
  });

  const matches: CrossColumnMatch[] = [];
  for (const [value, aRows] of indexA) {
    const bRows = indexB.get(value);
    if (bRows) {
      matches.push({ value, rowsA: aRows, rowsB: bRows });
    }
  }

  return { matches, totalMatched: matches.length };
};

// ─── Detector de duplicatas ────────────────────────────────────────────

export interface DuplicateGroup {
  value: string;
  /** Linhas (1-based) que compartilham esse valor. */
  rows: number[];
}

export interface DuplicatesResult {
  duplicates: DuplicateGroup[];
  /** Quantos grupos duplicados. */
  totalGroups: number;
  /** Quantas linhas envolvidas no total. */
  totalRows: number;
}

/**
 * Encontra valores que aparecem mais de uma vez na coluna `column`. Ordenado do
 * grupo maior pro menor. Util pra achar peca cadastrada em duplicidade.
 */
export const findDuplicateRows = (
  rows: RawPartRow[],
  column: string,
  transform: ValueTransform = 'none'
): DuplicatesResult => {
  const index = new Map<string, number[]>();
  rows.forEach((row, i) => {
    const v = normalizeForCompare(findColumnValue(row, column), transform);
    if (!v) return;
    (index.get(v) ?? index.set(v, []).get(v)!).push(i + 1);
  });

  const duplicates: DuplicateGroup[] = [];
  let totalRows = 0;
  for (const [value, rowList] of index) {
    if (rowList.length > 1) {
      duplicates.push({ value, rows: rowList });
      totalRows += rowList.length;
    }
  }
  duplicates.sort((a, b) => b.rows.length - a.rows.length);

  return { duplicates, totalGroups: duplicates.length, totalRows };
};
