import type { PartCanonical } from '../../modules/importer/schemas/part.schema';

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

export const getPartRawLocation = (
  part: PartCanonical | undefined
): string | null => {
  if (!part) return null;

  const candidate = part as PartCanonical & {
    storage_location_name?: unknown;
    storageLocationName?: unknown;
    localizacao?: unknown;
    local?: unknown;
    raw?: Record<string, unknown> | null;
  };
  const raw = candidate.raw ?? candidate.sourceRow ?? {};

  return (
    text(candidate.storage_location_name) ??
    text(candidate.storageLocationName) ??
    text(candidate.location) ??
    text(candidate.localizacao) ??
    text(candidate.local) ??
    text(raw.storage_location_name) ??
    text(raw.localizacao) ??
    text(raw.location)
  );
};

