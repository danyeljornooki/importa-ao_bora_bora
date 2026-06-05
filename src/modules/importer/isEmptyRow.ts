import { aliasesByField } from './fieldAliases';

const normalizeHeader = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

const isEmptyValue = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim().length === 0;
  }

  if (typeof value === 'number') {
    return Number.isNaN(value);
  }

  if (typeof value === 'boolean') {
    return false;
  }

  if (Array.isArray(value)) {
    return value.every(isEmptyValue);
  }

  return false;
};

const findAliasValue = (row: Record<string, unknown>, aliases: readonly string[]) => {
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

export const isEmptyRow = (row: Record<string, unknown>): boolean => {
  if (!row || typeof row !== 'object') {
    return true;
  }

  const usefulFields: Array<keyof typeof aliasesByField> = [
    'code',
    'title',
    'price',
    'description',
  ];

  const hasUsefulData = usefulFields.some((field) => {
    const value = findAliasValue(row, aliasesByField[field]);
    return !isEmptyValue(value);
  });

  return !hasUsefulData;
};
