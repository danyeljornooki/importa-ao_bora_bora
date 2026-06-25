import { locationSlugPart } from './normalizeLocationInput';

export const buildLocationPathText = (parts: string[]): string =>
  parts.map((part) => part.trim()).filter(Boolean).join(' > ');

export const buildLocationPathSlugs = (parts: string[]): string[] =>
  parts.map(locationSlugPart).filter(Boolean);

export const buildLocationPathPrefixes = (slugs: string[]): string[] =>
  slugs.map((_, index) => slugs.slice(0, index + 1).join('/'));
