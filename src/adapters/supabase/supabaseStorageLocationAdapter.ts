import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  StorageLocation,
  StorageLocationPayload,
} from '../../core/locations/location.types';
import type { StorageLocationAdapter } from '../../core/locations/storageLocationAdapter';
import { supabase as defaultSupabase } from './supabaseClient';

const hasValue = (value: unknown): boolean =>
  value !== null && value !== undefined && String(value).trim() !== '';

const requiredString = (value: unknown, field: string): string => {
  if (!hasValue(value)) {
    throw new Error(`storage_locations.${field} ausente`);
  }
  return String(value);
};

const optionalStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : undefined;

const mapStorageLocation = (row: Record<string, unknown>): StorageLocation => ({
  _id: requiredString(row.id ?? row._id, 'id'),
  store_id: requiredString(row.store_id, 'store_id'),
  name: requiredString(row.name, 'name'),
  abbreviation: hasValue(row.abbreviation) ? String(row.abbreviation) : null,
  path_text: hasValue(row.path_text) ? String(row.path_text) : null,
  location_path_text: hasValue(row.location_path_text)
    ? String(row.location_path_text)
    : null,
  location_path_key: hasValue(row.location_path_key)
    ? String(row.location_path_key)
    : null,
  location_path_names: optionalStringArray(row.location_path_names),
  location_path_slugs: optionalStringArray(row.location_path_slugs),
  path_ids: optionalStringArray(row.path_ids),
  path_items: Array.isArray(row.path_items)
    ? row.path_items as StorageLocation['path_items']
    : undefined,
  status: hasValue(row.status) ? String(row.status) : undefined,
});

export const createSupabaseStorageLocationAdapter = (
  client: SupabaseClient = defaultSupabase
): StorageLocationAdapter => ({
  async findCandidates(storeId: string): Promise<StorageLocation[]> {
    if (!hasValue(storeId)) {
      throw new Error('storeId obrigatorio para carregar storage_locations');
    }

    const { data, error } = await client
      .from('storage_locations')
      .select(`
        id,
        store_id,
        name,
        abbreviation,
        path_text,
        location_path_text,
        location_path_key,
        location_path_names,
        location_path_slugs,
        path_ids,
        path_items,
        status
      `)
      .eq('store_id', storeId)
      .neq('status', 'deleted');

    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(mapStorageLocation);
  },

  async createLocation(
    payload: StorageLocationPayload
  ): Promise<StorageLocation> {
    const { data, error } = await client
      .from('storage_locations')
      .insert(payload)
      .select(`
        id,
        store_id,
        name,
        abbreviation,
        path_text,
        location_path_text,
        location_path_key,
        location_path_names,
        location_path_slugs,
        path_ids,
        path_items,
        status
      `)
      .single();

    if (error) throw error;
    return mapStorageLocation(data as Record<string, unknown>);
  },
});

export const supabaseStorageLocationAdapter: StorageLocationAdapter =
  createSupabaseStorageLocationAdapter();
