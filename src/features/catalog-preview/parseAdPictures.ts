import type { CatalogPicture } from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

const toPicture = (value: unknown): CatalogPicture | null => {
  if (!isRecord(value)) return null;

  const picture: CatalogPicture = {
    id: optionalString(value.id),
    url: optionalString(value.url),
    secure_url: optionalString(value.secure_url),
    size: optionalString(value.size),
    max_size: optionalString(value.max_size),
  };

  return picture.url || picture.secure_url ? picture : null;
};

export const parseAdPictures = (value: unknown): CatalogPicture[] => {
  let source = value;

  if (typeof value === 'string') {
    try {
      source = JSON.parse(value);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(source)) return [];
  return source.map(toPicture).filter((picture): picture is CatalogPicture => Boolean(picture));
};

export const firstPictureUrl = (
  pictures: CatalogPicture[],
  rawData?: Record<string, unknown> | null
): string | null => {
  const picture = pictures[0];
  return picture?.secure_url ?? picture?.url ?? optionalString(rawData?.thumbnail) ?? null;
};

export default parseAdPictures;
