import { aliasesByField } from './fieldAliases';
import { PartCanonical, RawPartRow } from './schemas/part.schema';

const normalizeHeader = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

const normalizeString = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized === '' ? null : normalized;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }

  return null;
};

const normalizeLocation = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  // A localizacao pode vir como caminho hierarquico separado por ">"
  // (ex: "GALPAO A > ESTRADA > Local 103"). A localizacao real e o ULTIMO
  // segmento; os anteriores sao so o caminho ate ela.
  const lastSegment = normalized.split('>').pop()?.trim() ?? '';
  if (!lastSegment) {
    return null;
  }

  const lower = lastSegment
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // Segmentos que nao representam uma localizacao fisica real.
  if (lower === 'excluido' || lower.startsWith('mlb')) {
    return null;
  }

  return lastSegment;
};

/**
 * Interpreta o identificador interno da peca vindo da planilha.
 * Regra (fiel a importacao Drive Parts):
 *  - comeca com digito  -> remove nao-digitos -> id_int NUMERICO ("1219c" -> 1219)
 *  - comeca com letra    -> id_string literal (codigo nao numerico)
 * Em Drive Parts o id_int e o identificador interno numerico (chave de dedup);
 * normalizar para number garante que "1219c" da planilha case com o id_int 1219
 * do inventario, independente de estar como number ou string no banco.
 */
export const normalizeInternalId = (
  value: unknown
): { id_int?: number; id_string?: string } => {
  const raw = normalizeString(value);
  if (!raw) {
    return {};
  }

  if (/^\d/.test(raw)) {
    const digits = raw.replace(/\D/g, '');
    const parsed = Number(digits);
    if (digits !== '' && Number.isFinite(parsed) && parsed > 0) {
      return { id_int: parsed };
    }
    // comecou com digito mas nao gerou um numero valido -> trata como string
    return { id_string: raw };
  }

  return { id_string: raw };
};

const normalizePrice = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      throw new Error('Campo obrigatório "price" está ausente ou inválido.');
    }

    let cleaned = trimmed.replace(/[^0-9.,-]/g, '');
    if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === ',') {
      throw new Error('Campo obrigatório "price" está ausente ou inválido.');
    }

    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');

    if (hasComma && hasDot) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
      cleaned = cleaned.replace(/,/g, '.');
    }

    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error('Campo obrigatório "price" está ausente ou inválido.');
};

const normalizeQuantity = (value: unknown, aliasKey?: string): number | null => {
  if (value === undefined || value === null) {
    return null;
  }

  let parsed: number | null = null;

  if (typeof value === 'number') {
    parsed = Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }

    const cleaned = trimmed.replace(/\s+/g, '').replace(',', '.');
    const numberValue = Number(cleaned);
    parsed = Number.isFinite(numberValue) ? numberValue : null;
  }

  if (parsed === null) {
    return null;
  }

  const normalizedAlias = aliasKey?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const isAvailableQuantity = normalizedAlias === 'quantidade_disponivel' || normalizedAlias === 'qtd_disponivel';

  if (isAvailableQuantity && parsed >= 1000 && parsed % 1000 === 0) {
    parsed = parsed / 1000;
  }

  return Math.max(0, parsed);
};

const normalizeMlbIds = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const values = Array.isArray(value) ? value : [value];
  const parts = values
    .flatMap((item) => {
      const normalized = normalizeString(item);
      if (!normalized) {
        return [] as string[];
      }
      // MLBs podem vir separados por / , ; | ou quebra de linha.
      // (Diferente das imagens: URLs contem "/", entao "/" NAO separa imagens.)
      return normalized.split(/[,;|\n\/]+/).map((item) => item.trim()).filter(Boolean);
    })
    .map((item) => item.toUpperCase().replace(/\s+/g, ''))
    .filter((item) => /^MLB\d+$/.test(item));

  const unique = Array.from(new Set(parts));
  return unique.length > 0 ? unique : undefined;
};

const normalizeImageUrls = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const values = Array.isArray(value) ? value : [value];
  const urls = values
    .flatMap((item) => {
      const normalized = normalizeString(item);
      if (!normalized) {
        return [] as string[];
      }
      return normalized.split(/[,;|\n]+/).map((item) => item.trim()).filter(Boolean);
    })
    .map((item) => item.replace(/\s+/g, ''))
    .filter((item) => /^https?:\/\/\S+/i.test(item));

  const unique = Array.from(new Set(urls));
  return unique.length > 0 ? unique : undefined;
};

const findAliasValue = (row: RawPartRow, aliases: readonly string[]): unknown => {
  const normalizedKeys = Object.keys(row).reduce<Record<string, string>>((acc, key) => {
    acc[normalizeHeader(key)] = key;
    return acc;
  }, {});

  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    const originalKey = normalizedKeys[normalizedAlias];
    if (originalKey) {
      return row[originalKey];
    }
  }

  return undefined;
};

const findAliasKey = (row: RawPartRow, aliases: readonly string[]): string | undefined => {
  const normalizedKeys = Object.keys(row).reduce<Record<string, string>>((acc, key) => {
    acc[normalizeHeader(key)] = normalizeHeader(key);
    return acc;
  }, {});

  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    if (normalizedKeys[normalizedAlias]) {
      return normalizedAlias;
    }
  }

  return undefined;
};

export const normalizePart = (row: RawPartRow, sheetTitle?: string): PartCanonical => {
  const idIntRaw = findAliasValue(row, aliasesByField.id_int);
  const codeRaw = findAliasValue(row, aliasesByField.code);
  const code = normalizeString(codeRaw);

  // Identidade interna: prioriza uma coluna `id_int` dedicada; se nao houver,
  // a coluna de codigo da planilha PODE ser o id_int. Em Drive Parts o id_int e
  // o identificador interno NUMERICO (chave de dedup) e historicamente e essa a
  // coluna de codigo que o cliente envia.
  let { id_int, id_string } = normalizeInternalId(idIntRaw);

  if (id_int === undefined && id_string === undefined && code) {
    // Sem id_int dedicado: o codigo da planilha PODE ser o id_int, MAS so promovemos
    // quando ele tem cara de id interno: digitos seguidos de um sufixo opcional de
    // letras ("1219c" -> 1219, "807216911" -> 807216911). Codigos OEM com letras no
    // meio ("5u0903025h") NAO sao promovidos — ficam so em `code`, pra nao fabricar
    // um id_int de dedup errado. (Coluna id_int dedicada e sempre confiavel; coluna
    // de codigo pode ser OEM, por isso aqui somos conservadores.)
    if (/^\d+[a-zA-Z]*$/.test(code)) {
      const digits = code.replace(/\D/g, '');
      const parsed = Number(digits);
      if (digits !== '' && Number.isFinite(parsed) && parsed > 0) {
        id_int = parsed;
      }
    }
  }

  const mlbIdsRaw = findAliasValue(row, aliasesByField.mlb_ids);
  const mlb_ids = normalizeMlbIds(mlbIdsRaw);

  const priceRaw = findAliasValue(row, aliasesByField.price);
  const price = normalizePrice(priceRaw);

  const titleRaw = findAliasValue(row, aliasesByField.title);
  const title = normalizeString(titleRaw) ?? (sheetTitle?.trim() || undefined);

  const locationRaw = findAliasValue(row, aliasesByField.location);
  const location = normalizeLocation(locationRaw);

  const quantityRaw = findAliasValue(row, aliasesByField.stock_quantity);
  const quantityAlias = findAliasKey(row, aliasesByField.stock_quantity);
  const stock_quantity = normalizeQuantity(quantityRaw, quantityAlias);

  const descriptionRaw = findAliasValue(row, aliasesByField.description);
  const description = normalizeString(descriptionRaw) ?? undefined;

  const imageUrlsRaw = findAliasValue(row, aliasesByField.image_urls);
  const image_urls = normalizeImageUrls(imageUrlsRaw);

  return {
    code,
    price,
    stock_quantity,
    location,
    title,
    description,
    mlb_ids,
    image_urls,
    id_int,
    id_string,
    sourceRow: row,
  };
};
