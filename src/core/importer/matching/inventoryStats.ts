import type { ExistingInventoryItem } from '../../../types/inventory.types';

export interface ExistingPartsIdentifierStats {
  missing_id_int: number;
  missing_code: number;
  missing_id_string: number;
}

const hasValue = (value: unknown): boolean =>
  value !== null && value !== undefined && String(value).trim() !== '';

export const getExistingPartsIdentifierStats = (
  items: Array<Partial<ExistingInventoryItem>>
): ExistingPartsIdentifierStats => {
  const stats: ExistingPartsIdentifierStats = {
    missing_id_int: 0,
    missing_code: 0,
    missing_id_string: 0,
  };

  for (const item of items) {
    if (!hasValue(item.id_int)) stats.missing_id_int += 1;
    if (!hasValue(item.code)) stats.missing_code += 1;
    if (!hasValue(item.id_string)) stats.missing_id_string += 1;
  }

  return stats;
};
