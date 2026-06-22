import {
  aliasesByField,
  canonicalFieldKeys,
  type CanonicalField,
  type FieldAliases,
} from './fieldAliases';
import type { RawPartRow } from './schemas/part.schema';

/**
 * Mapeamento ASSISTIDO de colunas.
 *
 * O `fieldAliases` faz match EXATO (depois de normalizar o cabecalho). Isso quebra
 * no primeiro cliente que nomear a coluna fora da lista ("Cod. Produto", "Qtd Estoque"
 * vs aliases conhecidos). Aqui estendemos: quando nao ha match exato, usamos
 * similaridade (Levenshtein normalizado + atalho de containment) contra o nome do
 * campo e seus aliases, sugerindo a melhor coluna acima de um limiar.
 *
 * A saida e uma SUGESTAO pra UI: o usuario confirma ou ajusta. Nada e decidido
 * automaticamente sem revisao. Modulo PURO (sem IO).
 */

export type MappingMatchKind = 'alias' | 'similarity' | 'none';

export interface FieldMappingSuggestion {
  field: CanonicalField;
  /** Cabecalho da planilha sugerido, ou null se nada passou do limiar. */
  header: string | null;
  /** 0..1 — 1 = match exato de alias. */
  score: number;
  matchedBy: MappingMatchKind;
}

export interface MappingSuggestionResult {
  suggestions: FieldMappingSuggestion[];
  /** Cabecalhos que nao foram associados a nenhum campo. */
  unmappedHeaders: string[];
}

export interface SuggestFieldMappingOptions {
  /** Limiar minimo de similaridade (padrao 0.5). */
  threshold?: number;
  /** Aliases a usar como sementes (padrao: os do projeto). */
  aliases?: FieldAliases;
}

const normalizeToken = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const levenshtein = (a: string, b: string): number => {
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return matrix[a.length][b.length];
};

const similarity = (a: string, b: string): number => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  // Containment so vale pra tokens com tamanho minimo, pra "id" nao casar com tudo.
  if ((a.length >= 4 || b.length >= 4) && (a.includes(b) || b.includes(a))) {
    return 0.8;
  }
  const maxLen = Math.max(a.length, b.length);
  return 1 - levenshtein(a, b) / maxLen;
};

/** Melhor similaridade do cabecalho contra o nome do campo + todos os aliases. */
const scoreHeaderForField = (
  headerToken: string,
  field: CanonicalField,
  aliases: FieldAliases
): { score: number; exact: boolean } => {
  const candidates = [field, ...aliases[field]];
  let best = 0;
  let exact = false;
  for (const candidate of candidates) {
    const token = normalizeToken(candidate);
    if (token === headerToken) {
      return { score: 1, exact: true };
    }
    const s = similarity(headerToken, token);
    if (s > best) best = s;
  }
  return { score: best, exact };
};

export const suggestFieldMapping = (
  headers: string[],
  options: SuggestFieldMappingOptions = {}
): MappingSuggestionResult => {
  const threshold = options.threshold ?? 0.5;
  const aliases = options.aliases ?? aliasesByField;

  const headerTokens = headers.map((h) => ({ header: h, token: normalizeToken(h) }));
  const usedHeaders = new Set<string>();

  // Pra cada campo, calcula o melhor cabecalho. Campos com match EXATO de alias
  // tem prioridade (resolvidos primeiro) pra nao perderem a coluna pra um fuzzy.
  const scored = canonicalFieldKeys.map((field) => {
    let bestHeader: string | null = null;
    let bestScore = 0;
    let bestExact = false;
    for (const { header, token } of headerTokens) {
      if (!token) continue;
      const { score, exact } = scoreHeaderForField(token, field, aliases);
      if (score > bestScore) {
        bestScore = score;
        bestHeader = header;
        bestExact = exact;
      }
    }
    return { field, bestHeader, bestScore, bestExact };
  });

  // Resolve exatos primeiro, depois fuzzy por score decrescente; cada cabecalho
  // so e usado uma vez (primeiro campo que o reivindica vence).
  const order = [...scored].sort((a, b) => {
    if (a.bestExact !== b.bestExact) return a.bestExact ? -1 : 1;
    return b.bestScore - a.bestScore;
  });

  const byField = new Map<CanonicalField, FieldMappingSuggestion>();
  for (const item of order) {
    if (
      item.bestHeader &&
      item.bestScore >= threshold &&
      !usedHeaders.has(item.bestHeader)
    ) {
      usedHeaders.add(item.bestHeader);
      byField.set(item.field, {
        field: item.field,
        header: item.bestHeader,
        score: Number(item.bestScore.toFixed(3)),
        matchedBy: item.bestExact ? 'alias' : 'similarity',
      });
    } else {
      byField.set(item.field, {
        field: item.field,
        header: null,
        score: 0,
        matchedBy: 'none',
      });
    }
  }

  const suggestions = canonicalFieldKeys.map((field) => byField.get(field)!);
  const unmappedHeaders = headers.filter((h) => !usedHeaders.has(h));

  return { suggestions, unmappedHeaders };
};

/** Mapeamento confirmado pelo usuario: campo canonico -> nome da coluna na planilha. */
export type ColumnMapping = Partial<Record<CanonicalField, string | null>>;

/**
 * Aplica um mapeamento confirmado sobre a linha crua: pra cada campo mapeado,
 * copia o valor da coluna escolhida pra chave que o `normalizePart` reconhece
 * (o primeiro alias do campo). Campos nao mapeados continuam sendo auto-detectados
 * pelos aliases. Puro — nao muta a linha original.
 */
export const applyColumnMapping = (
  row: RawPartRow,
  mapping?: ColumnMapping,
  aliases: FieldAliases = aliasesByField
): RawPartRow => {
  if (!mapping) return row;
  const effective: RawPartRow = { ...row };
  for (const field of Object.keys(mapping) as CanonicalField[]) {
    const header = mapping[field];
    if (header && Object.prototype.hasOwnProperty.call(row, header)) {
      effective[aliases[field][0]] = row[header];
    }
  }
  return effective;
};

export default suggestFieldMapping;
