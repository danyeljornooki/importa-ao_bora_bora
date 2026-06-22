import type { RawPartRow } from './schemas/part.schema';

/**
 * Regras de filtro de linha CONFIGURAVEIS PELO USUARIO.
 *
 * Em vez de regras de exclusao fixas no codigo ("EXCLUIDO pula", "codigo vazio
 * rejeita"), o usuario define, por importacao, quais linhas NAO devem entrar.
 * Cada cliente usa convencoes diferentes (EXCLUIDO, REMOVIDO, INATIVO, ...),
 * entao a decisao e dele, nao nossa.
 *
 * Exemplos:
 *  - { column: 'codigo', condition: 'equals',  value: 'EXCLUIDO' } -> nao importa linhas marcadas EXCLUIDO
 *  - { column: 'codigo', condition: 'isEmpty' }                    -> nao importa linhas sem codigo
 *  - { column: 'status', condition: 'contains', value: 'inativ' }  -> nao importa inativos
 *
 * Este modulo e PURO (sem IO). A avaliacao roda sobre a linha CRUA da planilha,
 * antes da normalizacao, pra o usuario poder referenciar qualquer coluna pelo nome.
 */

export type RowFilterCondition =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'isEmpty'
  | 'isNotEmpty';

export interface RowFilterRule {
  /** Nome da coluna na planilha (match e tolerante a acento/caixa). */
  column: string;
  condition: RowFilterCondition;
  /** Valor de comparacao (para equals/notEquals/contains/notContains). */
  value?: string;
  /** O que fazer quando a regra casa. Por enquanto so 'skip' (nao importar). */
  action?: 'skip';
  /** Comparacao ignora caixa? (padrao true) */
  caseInsensitive?: boolean;
  /** Comparacao ignora acentos? (padrao true) */
  ignoreAccents?: boolean;
}

export interface RowFilterResult {
  /** true = a linha NAO deve ser importada. */
  excluded: boolean;
  matchedRule?: RowFilterRule;
  reason?: string;
}

const stripAccents = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '');

const normalizeHeader = (value: string): string =>
  stripAccents(String(value)).toLowerCase().trim();

const prepareValue = (value: unknown, rule: RowFilterRule): string => {
  let text = value === null || value === undefined ? '' : String(value).trim();
  if (rule.ignoreAccents !== false) text = stripAccents(text);
  if (rule.caseInsensitive !== false) text = text.toLowerCase();
  return text;
};

/** Acha o valor da coluna na linha, casando o nome de forma tolerante. */
const findColumnValue = (row: RawPartRow, column: string): unknown => {
  const target = normalizeHeader(column);
  for (const key of Object.keys(row)) {
    if (normalizeHeader(key) === target) {
      return row[key];
    }
  }
  return undefined;
};

const describeRule = (rule: RowFilterRule): string => {
  const labels: Record<RowFilterCondition, string> = {
    equals: `= "${rule.value ?? ''}"`,
    notEquals: `≠ "${rule.value ?? ''}"`,
    contains: `contém "${rule.value ?? ''}"`,
    notContains: `não contém "${rule.value ?? ''}"`,
    isEmpty: 'vazio',
    isNotEmpty: 'preenchido',
  };
  return `linha excluída pela regra: ${rule.column} ${labels[rule.condition]}`;
};

const matchesRule = (row: RawPartRow, rule: RowFilterRule): boolean => {
  const cell = prepareValue(findColumnValue(row, rule.column), rule);
  const value = rule.value !== undefined ? prepareValue(rule.value, rule) : '';

  switch (rule.condition) {
    case 'equals':
      return cell === value;
    case 'notEquals':
      return cell !== value;
    case 'contains':
      return value !== '' && cell.includes(value);
    case 'notContains':
      return value !== '' && !cell.includes(value);
    case 'isEmpty':
      return cell === '';
    case 'isNotEmpty':
      return cell !== '';
    default:
      return false;
  }
};

/**
 * Avalia as regras do usuario contra UMA linha crua. A primeira regra que casar
 * exclui a linha (curto-circuito). Sem regras (ou nenhuma casa) -> nao excluida.
 */
export const evaluateRowFilters = (
  row: RawPartRow,
  rules: RowFilterRule[] = []
): RowFilterResult => {
  for (const rule of rules) {
    if (matchesRule(row, rule)) {
      return { excluded: true, matchedRule: rule, reason: describeRule(rule) };
    }
  }
  return { excluded: false };
};

export default evaluateRowFilters;
