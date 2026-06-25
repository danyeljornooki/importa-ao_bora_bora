import 'server-only';
import { getMongoDb } from '../../lib/mongoServer';
import type {
  ExistingInventoryItem,
  InventoryPersistenceAdapter,
  PersistenceActionResult,
} from '../../types/inventory.types';

/**
 * Adapter de inventario MongoDB (Drive Parts). SERVER-ONLY — usado só por API
 * routes, nunca pelo cliente (o driver mongodb não roda no browser).
 *
 * ⚠️ FASE ATUAL: SOMENTE LEITURA. Não há NENHUMA operação de escrita aqui —
 * sem insert, update ou delete. createItem/updateItem recusam imediatamente, sem
 * tocar no banco. A escrita será construída depois, passo a passo, quando
 * explicitamente autorizada.
 */

const COLLECTION = 'inventory_items';

const toNumberOrNull = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};

const str = (v: unknown): string | null =>
  v === null || v === undefined || String(v).trim() === '' ? null : String(v);

const mapDoc = (doc: Record<string, unknown>): ExistingInventoryItem => ({
  id: String(doc._id),
  store_id: String(doc.store_id ?? ''),
  id_int: toNumberOrNull(doc.id_int),
  id_string: str(doc.id_string) ?? str(doc.primary_anuncio_mlb_id),
  primary_anuncio_mlb_id: str(doc.primary_anuncio_mlb_id),
  code: str(doc.code),
  tag_code: str(doc.tag_code),
  marketplace_name: str(doc.marketplace_name),
  description: str(doc.description),
  location: str(doc.storage_location_name),
  storage_location_id: str(doc.storage_location_id),
  storage_location_name: str(doc.storage_location_name),
  stock_quantity: toNumberOrNull(doc.stock_quantity),
  price: toNumberOrNull(doc.price),
  status: str(doc.status),
  deleted: typeof doc.deleted === 'boolean' ? doc.deleted : null,
});

const WRITE_DISABLED: PersistenceActionResult = {
  success: false,
  error: 'Escrita no Mongo NÃO está implementada nesta fase (apenas leitura/análise).',
};

export const mongoInventoryAdapter: InventoryPersistenceAdapter = {
  // ÚNICA operação ativa: leitura. find() sem nenhuma escrita.
  async loadStoreInventory(storeId: string): Promise<ExistingInventoryItem[]> {
    if (!storeId || String(storeId).trim() === '') {
      throw new Error('storeId obrigatório para carregar inventory_items');
    }
    const db = await getMongoDb();
    const docs = await db
      .collection(COLLECTION)
      .find(
        { store_id: String(storeId), deleted: { $ne: true } },
        {
          projection: {
            store_id: 1, id_int: 1, id_string: 1, primary_anuncio_mlb_id: 1,
            code: 1, tag_code: 1, marketplace_name: 1, description: 1,
            storage_location_id: 1, storage_location_name: 1,
            stock_quantity: 1, price: 1, status: 1, deleted: 1,
          },
        }
      )
      .toArray();
    return docs.map(mapDoc);
  },

  // Escrita propositalmente NÃO implementada — não toca no banco.
  async createItem(): Promise<PersistenceActionResult> {
    return WRITE_DISABLED;
  },

  async updateItem(): Promise<PersistenceActionResult> {
    return WRITE_DISABLED;
  },
};

export default mongoInventoryAdapter;
