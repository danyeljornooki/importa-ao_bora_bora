import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from './supabaseClient';
import { sanitizeSupabasePayload } from '../../modules/importer/persistence/sanitizeSupabasePayload';
import type {
  ExistingInventoryItem,
  InventoryPersistenceAdapter,
  InventoryPersistencePayload,
  PersistenceActionResult,
} from '../../types/inventory.types';

const PAGE_SIZE = 1000;

const hasValue = (value: unknown): boolean =>
  value !== null && value !== undefined && String(value).trim() !== '';

const requiredString = (value: unknown, field: string): string => {
  if (!hasValue(value)) {
    throw new Error(`inventory_items.${field} ausente`);
  }
  return String(value);
};

const optionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const inventoryIdString = (row: Record<string, unknown>): string | null => {
  const value = hasValue(row.id_string)
    ? row.id_string
    : row.primary_anuncio_mlb_id;

  return hasValue(value) ? String(value).trim() : null;
};

const mapInventoryItem = (row: Record<string, unknown>): ExistingInventoryItem => ({
  id: requiredString(row.id, 'id'),
  store_id: requiredString(row.store_id, 'store_id'),
  id_int: optionalNumber(row.id_int),
  id_string: inventoryIdString(row),
  primary_anuncio_mlb_id: hasValue(row.primary_anuncio_mlb_id)
    ? String(row.primary_anuncio_mlb_id).trim()
    : null,
  code: hasValue(row.code) ? String(row.code) : null,
  tag_code: hasValue(row.tag_code) ? String(row.tag_code) : null,
  marketplace_name: hasValue(row.marketplace_name) ? String(row.marketplace_name) : null,
  description: hasValue(row.description) ? String(row.description) : null,
  location: hasValue(row.storage_location_name)
    ? String(row.storage_location_name)
    : null,
  storage_location_id: hasValue(row.storage_location_id)
    ? String(row.storage_location_id)
    : null,
  storage_location_name: hasValue(row.storage_location_name)
    ? String(row.storage_location_name)
    : null,
  stock_quantity: optionalNumber(row.stock_quantity),
  price: optionalNumber(row.price),
  status: hasValue(row.status) ? String(row.status) : null,
  deleted: typeof row.deleted === 'boolean' ? row.deleted : null,
});

export const createSupabaseInventoryAdapter = (
  client: SupabaseClient = defaultSupabase
): InventoryPersistenceAdapter => ({
  async loadStoreInventory(storeId: string): Promise<ExistingInventoryItem[]> {
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
          primary_anuncio_mlb_id,
          code,
          tag_code,
          marketplace_name,
          description,
          storage_location_id,
          storage_location_name,
          stock_quantity,
          price,
          status,
          deleted
        `)
        .eq('store_id', storeId)
        .eq('deleted', false)
        .range(from, to);

      if (error) throw error;

      const page = (data ?? []) as Record<string, unknown>[];
      items.push(...page.map(mapInventoryItem));

      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    return items;
  },

  async createItem(
    payload: InventoryPersistencePayload
  ): Promise<PersistenceActionResult> {
    try {
      const { data, error } = await client
        .from('inventory_items')
        .insert(sanitizeSupabasePayload(payload))
        .select('id')
        .single();

      return error
        ? { success: false, error: error.message }
        : { success: true, id: requiredString(data?.id, 'id') };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  async updateItem(
    targetId: string,
    payload: InventoryPersistencePayload,
    options = {}
  ): Promise<PersistenceActionResult> {
    if (!hasValue(targetId)) {
      return { success: false, error: 'Missing targetId for update' };
    }

    try {
      const storeId = options.storeId?.trim();
      let query = client
        .from('inventory_items')
        .update(sanitizeSupabasePayload(payload))
        .eq('id', targetId);

      if (storeId) {
        query = query.eq('store_id', storeId);
      } else if (process.env.NODE_ENV !== 'production') {
        console.warn(
          '[supabaseInventoryAdapter] updateItem sem storeId; atualização limitada apenas por id.'
        );
      }

      const { error } = await query;

      return error
        ? { success: false, error: error.message }
        : { success: true, id: targetId };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});

export const supabaseInventoryAdapter: InventoryPersistenceAdapter =
  createSupabaseInventoryAdapter();
