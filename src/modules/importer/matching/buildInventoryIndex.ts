import type { ExistingInventoryItem } from '../persistence/loadExistingPartsFromSupabase';

export interface InventoryIndex {
  items: ExistingInventoryItem[];
  byIdInt: Map<number, ExistingInventoryItem>;
  byCode: Map<string, ExistingInventoryItem>;
  byIdString: Map<string, ExistingInventoryItem>;
  titleCandidates: Array<{ normalizedTitle: string; item: ExistingInventoryItem }>;
}

const normalizeText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized === '' ? null : normalized;
};

export const normalizeIndexKey = (value: unknown): string | null => {
  const normalized = normalizeText(value);
  return normalized ? normalized.toLowerCase() : null;
};

export const normalizeTitleKey = (value: unknown): string | null => {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  return normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

const isDeleted = (item: ExistingInventoryItem): boolean =>
  item.deleted === true || normalizeIndexKey(item.status) === 'deleted';

export const buildInventoryIndex = (items: ExistingInventoryItem[]): InventoryIndex => {
  const byIdInt = new Map<number, ExistingInventoryItem>();
  const byCode = new Map<string, ExistingInventoryItem>();
  const byIdString = new Map<string, ExistingInventoryItem>();
  const titleCandidates: Array<{ normalizedTitle: string; item: ExistingInventoryItem }> = [];
  const activeItems = (items ?? []).filter((item) => !isDeleted(item));

  for (const item of activeItems) {
    if (typeof item.id_int === 'number' && Number.isFinite(item.id_int) && !byIdInt.has(item.id_int)) {
      byIdInt.set(item.id_int, item);
    }

    const code = normalizeIndexKey(item.code);
    if (code && !byCode.has(code)) {
      byCode.set(code, item);
    }

    const idString = normalizeIndexKey(item.id_string);
    if (idString && !byIdString.has(idString)) {
      byIdString.set(idString, item);
    }

    const title = normalizeTitleKey(item.marketplace_name);
    if (title) {
      titleCandidates.push({ normalizedTitle: title, item });
    }
  }

  return {
    items: activeItems,
    byIdInt,
    byCode,
    byIdString,
    titleCandidates,
  };
};

export default buildInventoryIndex;
