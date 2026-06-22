import type { RawPartRow } from '../importer/schemas/part.schema';
import { normalizeForCompare, type ValueTransform } from '../importer/diagnostics';

/**
 * Auditoria pós-importação: compara DUAS planilhas por uma coluna-chave e
 * classifica cada registro em idêntico / divergente / só na A / só na B.
 *
 * Caso de uso: depois de importar, conferir a planilha exportada do sistema (B)
 * contra a planilha de origem do cliente (A) — achar peça que não entrou, campo
 * que entrou errado, etc. Modulo PURO.
 */

export interface AuditFieldMapping {
  /** Rótulo legível do campo (ex: "Preço"). */
  label: string;
  /** Coluna na planilha A. */
  colA: string;
  /** Coluna na planilha B. */
  colB: string;
  /** Tratamento aplicado antes de comparar os valores deste campo. */
  transform?: ValueTransform;
}

export interface AuditConfig {
  keyA: string;
  keyB: string;
  /** Tratamento aplicado à chave dos dois lados (ex: 'digits' p/ "1234C" = "1234"). */
  keyTransform?: ValueTransform;
  /** Campos a comparar entre os pares casados. Vazio = só casa por chave. */
  fields?: AuditFieldMapping[];
}

export interface AuditFieldDifference {
  label: string;
  valueA: unknown;
  valueB: unknown;
}

export interface AuditRecord {
  key: string;
  rowA?: RawPartRow;
  rowB?: RawPartRow;
  differences?: AuditFieldDifference[];
}

export interface AuditSummary {
  totalA: number;
  totalB: number;
  matched: number;
  divergent: number;
  onlyInA: number;
  onlyInB: number;
  /** % de chaves de A que foram encontradas em B. */
  matchRate: number;
}

export interface AuditResult {
  matched: AuditRecord[];
  divergent: AuditRecord[];
  onlyInA: AuditRecord[];
  onlyInB: AuditRecord[];
  summary: AuditSummary;
}

const indexByKey = (
  rows: RawPartRow[],
  keyColumn: string,
  transform: ValueTransform
): Map<string, RawPartRow> => {
  const map = new Map<string, RawPartRow>();
  for (const row of rows) {
    const key = normalizeForCompare(row[keyColumn], transform);
    if (key && !map.has(key)) {
      map.set(key, row);
    }
  }
  return map;
};

const diffFields = (
  rowA: RawPartRow,
  rowB: RawPartRow,
  fields: AuditFieldMapping[]
): AuditFieldDifference[] => {
  const differences: AuditFieldDifference[] = [];
  for (const field of fields) {
    const a = normalizeForCompare(rowA[field.colA], field.transform ?? 'none');
    const b = normalizeForCompare(rowB[field.colB], field.transform ?? 'none');
    if (a !== b) {
      differences.push({ label: field.label, valueA: rowA[field.colA], valueB: rowB[field.colB] });
    }
  }
  return differences;
};

export const compareTables = (
  rowsA: RawPartRow[],
  rowsB: RawPartRow[],
  config: AuditConfig
): AuditResult => {
  const keyTransform = config.keyTransform ?? 'none';
  const fields = config.fields ?? [];

  const mapA = indexByKey(rowsA, config.keyA, keyTransform);
  const mapB = indexByKey(rowsB, config.keyB, keyTransform);

  const matched: AuditRecord[] = [];
  const divergent: AuditRecord[] = [];
  const onlyInA: AuditRecord[] = [];
  const onlyInB: AuditRecord[] = [];

  for (const [key, rowA] of mapA) {
    const rowB = mapB.get(key);
    if (!rowB) {
      onlyInA.push({ key, rowA });
      continue;
    }
    const differences = diffFields(rowA, rowB, fields);
    if (differences.length > 0) {
      divergent.push({ key, rowA, rowB, differences });
    } else {
      matched.push({ key, rowA, rowB });
    }
  }

  for (const [key, rowB] of mapB) {
    if (!mapA.has(key)) {
      onlyInB.push({ key, rowB });
    }
  }

  const totalA = mapA.size;
  const totalB = mapB.size;
  const matchedCount = matched.length + divergent.length;

  return {
    matched,
    divergent,
    onlyInA,
    onlyInB,
    summary: {
      totalA,
      totalB,
      matched: matched.length,
      divergent: divergent.length,
      onlyInA: onlyInA.length,
      onlyInB: onlyInB.length,
      matchRate: totalA > 0 ? Number(((matchedCount / totalA) * 100).toFixed(1)) : 0,
    },
  };
};

export default compareTables;
