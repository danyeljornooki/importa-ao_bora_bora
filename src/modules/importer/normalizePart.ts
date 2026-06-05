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

  const lower = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (lower === 'excluido' || lower === 'excluido' || lower.startsWith('mlb')) {
    return null;
  }

  return normalized;
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
      return normalized.split(/[,;|\n]+/).map((item) => item.trim()).filter(Boolean);
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
  const id_int = normalizeString(idIntRaw) ?? undefined;

  const codeRaw = findAliasValue(row, aliasesByField.code);
  const code = normalizeString(codeRaw);

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
    sourceRow: row,
  };
};
