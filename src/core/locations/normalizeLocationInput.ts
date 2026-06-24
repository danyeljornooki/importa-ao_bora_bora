import type { NormalizedLocationInput } from './location.types';

const removeDiacritics = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const slugPart = (value: string): string =>
  removeDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const normalizeLocationInput = (raw: string): NormalizedLocationInput => {
  const original = String(raw ?? '');
  const withSeparators = original
    .replace(/[>\/\\|]+/g, ' > ')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = withSeparators
    .split('>')
    .map((part) => part.replace(/\s+/g, ' ').trim().toUpperCase())
    .filter(Boolean);

  const normalizedText = parts.join(' > ');
  const pathKey = parts.map(slugPart).filter(Boolean).join('/');

  return {
    original,
    normalizedText,
    parts,
    pathKey,
  };
};

export const locationSlugPart = slugPart;
