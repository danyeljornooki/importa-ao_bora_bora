import type { InventoryPersistencePayload } from '../../../types/inventory.types';

export interface SupabaseInventoryPayload {
  store_id?: string | null;
  id_int?: number | null;
  id_string?: string | null;
  code?: string | null;
  tag_code?: string | null;
  marketplace_name?: string | null;
  marketplace_name_normalized?: string | null;
  vehicle_brand_name?: string | null;
  vehicle_model_name?: string | null;
  vehicle_year?: string | null;
  vehicle_category_name?: string | null;
  stock_quantity?: number | null;
  price?: number | null;
  marketplace_price?: number | null;
  use_default_price?: boolean | null;
  status?: string | null;
  part_category_id?: string | null;
  part_category_name?: string | null;
  mercado_libre_brasil_category_id?: string | null;
  storage_location_id?: string | null;
  storage_location_name?: string | null;
  description?: string | null;
  catalog_attributes?: unknown[] | null;
  image_count?: number | null;
  primary_anuncio_id?: string | null;
  primary_anuncio_mlb_id?: string | null;
  primary_anuncio_status?: string | null;
  deleted?: boolean | null;
  deleted_at?: string | null;
}

const allowedFields: Array<keyof SupabaseInventoryPayload> = [
  'store_id',
  'id_int',
  'id_string',
  'code',
  'tag_code',
  'marketplace_name',
  'marketplace_name_normalized',
  'vehicle_brand_name',
  'vehicle_model_name',
  'vehicle_year',
  'vehicle_category_name',
  'stock_quantity',
  'price',
  'marketplace_price',
  'use_default_price',
  'status',
  'part_category_id',
  'part_category_name',
  'mercado_libre_brasil_category_id',
  'storage_location_id',
  'storage_location_name',
  'description',
  'catalog_attributes',
  'image_count',
  'primary_anuncio_id',
  'primary_anuncio_mlb_id',
  'primary_anuncio_status',
  'deleted',
  'deleted_at',
];

export function sanitizeSupabasePayload(
  payload: InventoryPersistencePayload
): SupabaseInventoryPayload {
  const record = payload as unknown as Record<string, unknown>;
  const sanitized: SupabaseInventoryPayload = {};

  for (const key of allowedFields) {
    const value = record[key];
    if (value === undefined) {
      continue;
    }

    // store_id must not be sent as null when the Supabase table enforces NOT NULL.
    if (key === 'store_id' && (value === null || value === '')) {
      continue;
    }

    (sanitized as Record<string, unknown>)[key] = value;
  }

  return sanitized;
}
