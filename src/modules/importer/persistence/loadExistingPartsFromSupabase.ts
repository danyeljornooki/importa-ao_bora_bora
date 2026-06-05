import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../../../lib/supabaseClient';

export type ExistingInventoryItem = {
  id: string;
  store_id: string;
  id_int?: number | null;
  id_string?: string | null;
  code?: string | null;
  tag_code?: string | null;
  marketplace_name?: string | null;
  stock_quantity?: number | null;
  price?: number | null;
  status?: string | null;
  deleted?: boolean | null;
  updated_at?: string | null;
  raw?: unknown;
};

export interface ExistingPartsIdentifierStats {
  missing_id_int: number;
  missing_code: number;
  missing_id_string: number;
}

export interface LoadExistingPartsResult {
  items: ExistingInventoryItem[];
  identifierStats: ExistingPartsIdentifierStats;
}

const PAGE_SIZE = 1000;

const hasValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  return String(value).trim() !== '';
};

const toStringOrThrow = (value: unknown, field: string): string => {
  if (!hasValue(value)) {
    throw new Error(`inventory_items.${field} ausente`);
  }
  return String(value);
};

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

const mapInventoryItem = (row: Record<string, unknown>): ExistingInventoryItem => ({
  id: toStringOrThrow(row.id, 'id'),
  store_id: toStringOrThrow(row.store_id, 'store_id'),
  id_int: typeof row.id_int === 'number' ? row.id_int : row.id_int == null ? null : Number(row.id_int),
  id_string: hasValue(row.id_string) ? String(row.id_string) : null,
  code: hasValue(row.code) ? String(row.code) : null,
  tag_code: hasValue(row.tag_code) ? String(row.tag_code) : null,
  marketplace_name: hasValue(row.marketplace_name) ? String(row.marketplace_name) : null,
  stock_quantity: typeof row.stock_quantity === 'number' ? row.stock_quantity : null,
  price: typeof row.price === 'number' ? row.price : null,
  status: hasValue(row.status) ? String(row.status) : null,
  deleted: typeof row.deleted === 'boolean' ? row.deleted : null,
  updated_at: hasValue(row.updated_at) ? String(row.updated_at) : null,
});

export const loadExistingPartsFromSupabase = async (
  storeId: string | number,
  client: SupabaseClient = defaultSupabase
): Promise<LoadExistingPartsResult> => {
  if (!hasValue(storeId)) {
    throw new Error('storeId obrigatorio para carregar inventory_items');
  }

  const items: ExistingInventoryItem[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await client
      .from('inventory_items')
      .select(`
        id,
        store_id,
        id_int,
        id_string,
        code,
        tag_code,
        marketplace_name,
        stock_quantity,
        price,
        status,
        deleted,
        updated_at
      `)
      .eq('store_id', storeId)
      .eq('deleted', false)
      .range(from, to);

    if (error) {
      throw error;
    }

    const page = (data ?? []) as Record<string, unknown>[];
    items.push(...page.map(mapInventoryItem));

    if (page.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  console.debug(`[EXISTING_PARTS] loaded=${items.length}`);

  return {
    items,
    identifierStats: getExistingPartsIdentifierStats(items),
  };
};

export default loadExistingPartsFromSupabase;
