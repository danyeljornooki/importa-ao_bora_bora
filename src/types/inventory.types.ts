export interface ExistingInventoryItem {
  id: string;
  store_id: string;

  id_int?: number | null;
  id_string?: string | null;
  primary_anuncio_mlb_id?: string | null;
  code?: string | null;
  tag_code?: string | null;

  marketplace_name?: string | null;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  location?: string | null;
  storage_location_id?: string | null;
  storage_location_name?: string | null;
  sku?: string | null;
  mercado_libre_brasil_category_id?: string | null;
  part_category_id?: string | null;

  stock_quantity?: number | null;
  price?: number | null;

  status?: string | null;
  deleted?: boolean | null;

  updated_at?: string | null;
  raw?: unknown;
}

export interface InventoryPersistencePayload {
  store_id: string;

  id_int?: number | null;
  id_string?: string | null;
  code?: string | null;
  tag_code?: string | null;

  marketplace_name?: string | null;
  marketplace_name_normalized?: string | null;
  description?: string | null;

  stock_quantity: number;
  status: 'DISPONIVEL' | 'SEM_ESTOQUE';

  price: number;
  marketplace_price: number;

  storage_location_id?: string | null;
  storage_location_name?: string | null;

  integrations?: Record<string, {
    id: string;
    status: 'active' | 'inactive';
    channel?: string | null;
    name?: string | null;
    user_id?: string | null;
    mlb_id?: string | null;
  }> | null;

  images: string[];
  image_count: number;

  catalog_attributes: unknown[];
  use_default_price: boolean;
  part_category_name?: string | null;
  mercado_libre_brasil_category_id?: string | null;

  sourceRow?: Record<string, unknown>;
}

export type InventoryPersistencePatch = Partial<InventoryPersistencePayload>;

export interface PersistenceActionResult {
  success: boolean;
  id?: string;
  error?: string;
}

export interface InventoryPersistenceAdapter {
  loadStoreInventory(storeId: string): Promise<ExistingInventoryItem[]>;

  createItem(payload: InventoryPersistencePayload): Promise<PersistenceActionResult>;

  updateItem(
    targetId: string,
    payload: InventoryPersistencePatch,
    options?: {
      storeId?: string;
    }
  ): Promise<PersistenceActionResult>;
}
