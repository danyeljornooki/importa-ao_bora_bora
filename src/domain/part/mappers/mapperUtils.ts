import type {
  PartImage,
  PartMarketplaceLink,
} from '../part.types';

export type UnknownRecord = Record<string, unknown>;

export const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null;

export const nullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized === '' ? null : normalized;
};

export const nullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const numberOrZero = (value: unknown): number =>
  nullableNumber(value) ?? 0;

export const uniqueStrings = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];

  return [
    ...new Set(
      values
        .map(nullableString)
        .filter((value): value is string => value !== null)
    ),
  ];
};

export const imagesFromUrls = (
  values: unknown,
  source: PartImage['source']
): PartImage[] =>
  uniqueStrings(values).map((url, index) => ({
    url,
    source,
    order: index,
  }));

export const imagesFromUnknown = (
  value: unknown,
  fallbackSource: PartImage['source']
): PartImage[] => {
  if (!Array.isArray(value)) return [];

  const images: PartImage[] = [];
  for (const [index, item] of value.entries()) {
    if (typeof item === 'string') {
      const url = nullableString(item);
      if (url) images.push({ url, source: fallbackSource, order: index });
      continue;
    }

    const record = asRecord(item);
    const url = nullableString(
      record?.url ?? record?.secure_url ?? record?.src
    );
    if (!url) continue;

    images.push({
      id: nullableString(record?.id),
      url,
      thumbnailUrl: nullableString(
        record?.thumbnailUrl ?? record?.thumbnail_url
      ),
      source: nullableString(record?.source) ?? fallbackSource,
      order: nullableNumber(record?.order) ?? index,
    });
  }

  return images;
};

export const marketplaceLinksFromMlbIds = (
  values: unknown
): PartMarketplaceLink[] =>
  uniqueStrings(values).map((marketplaceId) => ({
    marketplace: 'mercado_livre_brasil',
    marketplaceId,
  }));

export const calculatedStatus = (
  stockQuantity: number,
  deleted?: boolean | null,
  explicitStatus?: unknown
): string => {
  if (deleted === true) return 'deleted';
  return nullableString(explicitStatus)
    ?? (stockQuantity > 0 ? 'DISPONIVEL' : 'SEM_ESTOQUE');
};
