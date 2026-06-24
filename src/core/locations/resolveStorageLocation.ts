import type {
  LocationInput,
  NormalizedLocationInput,
  ResolvedStorageLocation,
  StorageLocation,
} from './location.types';
import type { StorageLocationAdapter } from './storageLocationAdapter';
import { buildStorageLocationPayload } from './buildStorageLocationPayload';
import { normalizeLocationInput } from './normalizeLocationInput';

const asText = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value).trim();

const normalizeComparable = (value: unknown): string =>
  asText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

const isActive = (location: StorageLocation): boolean =>
  normalizeComparable(location.status || 'active') === 'active';

const notDeleted = (location: StorageLocation): boolean =>
  normalizeComparable(location.status) !== 'deleted';

const pathText = (location: StorageLocation): string =>
  asText(location.location_path_text || location.path_text || location.name);

const byPriority = (
  locations: StorageLocation[],
  normalized: NormalizedLocationInput
): StorageLocation[] => {
  const normalizedText = normalizeComparable(normalized.normalizedText);
  const pathKey = normalizeComparable(normalized.pathKey);

  const levels: Array<(location: StorageLocation) => boolean> = [
    (location) => normalizeComparable(location.location_path_key) === pathKey,
    (location) => normalizeComparable(location.path_text) === normalizedText,
    (location) => normalizeComparable(location.location_path_text) === normalizedText,
    (location) => asText(location.name) === normalized.normalizedText,
    (location) => normalizeComparable(location.name) === normalizedText,
    (location) => normalizeComparable(location.abbreviation) === normalizedText,
  ];

  for (const matches of levels) {
    const candidates = locations.filter(matches);
    if (candidates.length > 0) return candidates;
  }

  return [];
};

const chooseCandidate = (
  candidates: StorageLocation[],
  normalized: NormalizedLocationInput
): StorageLocation | null => {
  if (candidates.length === 1) return candidates[0];

  const active = candidates.filter(isActive);
  const pool = active.length > 0 ? active : candidates;
  const fullPath = pool.filter(
    (location) => normalizeComparable(pathText(location)) === normalizeComparable(normalized.normalizedText)
  );

  if (fullPath.length === 1) return fullPath[0];
  if (pool.length === 1) return pool[0];

  return null;
};

export const resolveStorageLocation = async (
  input: LocationInput,
  adapter: StorageLocationAdapter
): Promise<ResolvedStorageLocation | null> => {
  if (!input.storeId?.trim()) return null;
  const normalized = normalizeLocationInput(input.rawLocation);
  if (!normalized.normalizedText) return null;

  const candidates = (await adapter.findCandidates(input.storeId))
    .filter((location) => location.store_id === input.storeId)
    .filter(notDeleted);
  const match = chooseCandidate(byPriority(candidates, normalized), normalized);

  if (match) {
    return {
      found: true,
      created: false,
      location: match,
      source: 'linked',
    };
  }

  const attemptedMatches = byPriority(candidates, normalized);
  if (attemptedMatches.length > 1) return null;

  const payload = buildStorageLocationPayload(input);
  if (!payload) return null;

  const created = await adapter.createLocation(payload);
  return {
    found: false,
    created: true,
    location: created,
    source: 'linked',
  };
};
