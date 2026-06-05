import type { PartCanonical } from '../schemas/part.schema';

export interface PartChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface CompareResult {
  changed: boolean;
  totalChanges: number;
  changes: PartChange[];
}

const fieldsToCompare: Array<keyof Omit<PartCanonical, 'sourceRow'>> = [
  'code',
  'price',
  'stock_quantity',
  'location',
  'title',
  'description',
  'mlb_ids',
  'image_urls',
  'id_int',
];

const normalizeString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized === '' ? null : normalized.toLowerCase();
  }
  return null;
};

const stringsEqual = (a: unknown, b: unknown): boolean => {
  const normalizedA = normalizeString(a);
  const normalizedB = normalizeString(b);
  return normalizedA === normalizedB;
};

const arrayContentsEqual = (a: unknown, b: unknown): boolean => {
  if (!Array.isArray(a) && !Array.isArray(b)) {
    return true;
  }

  if (!Array.isArray(a) || !Array.isArray(b)) {
    return false;
  }

  if (a.length !== b.length) {
    return false;
  }

  const setA = new Set(a.map((item) => JSON.stringify(item)));
  const setB = new Set(b.map((item) => JSON.stringify(item)));

  if (setA.size !== setB.size) {
    return false;
  }

  for (const item of setA) {
    if (!setB.has(item)) {
      return false;
    }
  }

  return true;
};

const valuesEqual = (fieldName: string, oldValue: unknown, newValue: unknown): boolean => {
  if (oldValue === undefined) {
    return true;
  }

  if (oldValue === undefined && newValue === undefined) {
    return true;
  }

  if (oldValue === null && newValue === null) {
    return true;
  }

  if (oldValue === null && newValue === undefined) {
    return true;
  }

  if (oldValue === undefined && newValue === null) {
    return true;
  }

  if (typeof oldValue === 'string' || typeof newValue === 'string') {
    return stringsEqual(oldValue, newValue);
  }

  if (Array.isArray(oldValue) || Array.isArray(newValue)) {
    return arrayContentsEqual(oldValue, newValue);
  }

  if (typeof oldValue === 'number' && typeof newValue === 'number') {
    return oldValue === newValue;
  }

  return oldValue === newValue;
};

export const comparePart = (
  importedPart: PartCanonical,
  existingPart: PartCanonical
): CompareResult => {
  const changes: PartChange[] = [];

  if (!importedPart || !existingPart) {
    return {
      changed: false,
      totalChanges: 0,
      changes: [],
    };
  }

  for (const field of fieldsToCompare) {
    const oldValue =
      field === 'title'
        ? existingPart.title ?? existingPart.marketplace_name
        : field === 'mlb_ids'
          ? existingPart.mlb_ids ?? (existingPart.id_string ? [existingPart.id_string] : undefined)
          : existingPart[field];
    const newValue = importedPart[field];

    if (!valuesEqual(field, oldValue, newValue)) {
      changes.push({
        field,
        oldValue,
        newValue,
      });
    }
  }

  return {
    changed: changes.length > 0,
    totalChanges: changes.length,
    changes,
  };
};
