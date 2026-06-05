export interface ResolvedLocation {
  _id: string;
  descricao: string;
}

export const resolveLocation = (location?: string | null): ResolvedLocation | null => {
  if (!location) return null;
  const normalized = String(location)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');

  if (!normalized) return null;

  return {
    _id: normalized,
    descricao: normalized,
  };
};

export default resolveLocation;
