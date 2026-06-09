import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createSupabaseInventoryAdapter,
} from '../../../adapters/supabase/supabaseInventoryAdapter';
import type { ExistingInventoryItem } from '../../../types/inventory.types';
import {
  getExistingPartsIdentifierStats,
  type ExistingPartsIdentifierStats,
} from '../../../core/importer/matching/inventoryStats';

export type { ExistingInventoryItem } from '../../../types/inventory.types';
export {
  getExistingPartsIdentifierStats,
  type ExistingPartsIdentifierStats,
} from '../../../core/importer/matching/inventoryStats';

export interface LoadExistingPartsResult {
  items: ExistingInventoryItem[];
  identifierStats: ExistingPartsIdentifierStats;
}

export const loadExistingPartsFromSupabase = async (
  storeId: string | number,
  client?: SupabaseClient
): Promise<LoadExistingPartsResult> => {
  const adapter = createSupabaseInventoryAdapter(client);
  const items = await adapter.loadStoreInventory(String(storeId));

  return {
    items,
    identifierStats: getExistingPartsIdentifierStats(items),
  };
};

export default loadExistingPartsFromSupabase;
