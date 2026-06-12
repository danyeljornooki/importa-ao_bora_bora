import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from './supabaseClient';
import type {
  MarketplaceAd,
  MarketplaceAdPayload,
  MarketplaceAdRegistryAdapter,
} from '../../types/marketplaceAd.types';

type SupabaseRow = Record<string, unknown>;

const asString = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value);

const asNullableString = (value: unknown): string | null =>
  value === null || value === undefined || String(value).trim() === ''
    ? null
    : String(value);

const asNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? [...value] : [];

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};

const mapMarketplaceAd = (row: SupabaseRow): MarketplaceAd => ({
  id: asString(row.id),
  storeId: asString(row.store_id),
  integrationId: asString(row.integration_id),
  pecaId: asNullableString(row.peca_id),
  marketplace: asString(row.marketplace),
  mlbId: asString(row.mlb_id),
  title: asNullableString(row.title),
  categoryId: asNullableString(row.category_id),
  catalogProductId: asNullableString(row.catalog_product_id),
  statusMl: asNullableString(row.status_ml),
  permalink: asNullableString(row.permalink),
  price: asNullableNumber(row.price),
  availableQuantity: asNullableNumber(row.available_quantity),
  sellerSku: asNullableString(row.seller_sku),
  pictures: asArray(row.pictures),
  attributes: asArray(row.attributes),
  plainText: asNullableString(row.plain_text),
  descriptionData: asRecord(row.description_data),
  rawData: asRecord(row.raw_data),
  isDuplicate: row.is_duplicate === true,
  duplicateOf: asNullableString(row.duplicate_of),
  duplicateReason: asNullableString(row.duplicate_reason),
  duplicateMarkedAt: asNullableString(row.duplicate_marked_at),
  lastSeenAt: asNullableString(row.last_seen_at),
  lastSyncAt: asNullableString(row.last_sync_at),
  createdAt: asNullableString(row.created_at),
  updatedAt: asNullableString(row.updated_at),
});

const insertRecord = (payload: MarketplaceAdPayload): SupabaseRow => ({
  store_id: payload.storeId,
  integration_id: payload.integrationId,
  peca_id: payload.pecaId ?? null,
  marketplace: payload.marketplace ?? 'mercado_livre_brasil',
  mlb_id: payload.mlbId,
  title: payload.title ?? null,
  category_id: payload.categoryId ?? null,
  catalog_product_id: payload.catalogProductId ?? null,
  status_ml: payload.statusMl ?? null,
  permalink: payload.permalink ?? null,
  price: payload.price ?? null,
  available_quantity: payload.availableQuantity ?? null,
  seller_sku: payload.sellerSku ?? null,
  pictures: payload.pictures ? [...payload.pictures] : [],
  attributes: payload.attributes ? [...payload.attributes] : [],
  plain_text: payload.plainText ?? null,
  description_data: payload.descriptionData
    ? { ...payload.descriptionData }
    : {},
  raw_data: payload.rawData ? { ...payload.rawData } : {},
  last_seen_at: payload.lastSeenAt ?? null,
  last_sync_at: payload.lastSyncAt ?? null,
});

const PATCH_FIELDS: Array<{
  input: keyof MarketplaceAdPayload;
  output: string;
  clone?: 'array' | 'record';
}> = [
  { input: 'storeId', output: 'store_id' },
  { input: 'integrationId', output: 'integration_id' },
  { input: 'pecaId', output: 'peca_id' },
  { input: 'marketplace', output: 'marketplace' },
  { input: 'mlbId', output: 'mlb_id' },
  { input: 'title', output: 'title' },
  { input: 'categoryId', output: 'category_id' },
  { input: 'catalogProductId', output: 'catalog_product_id' },
  { input: 'statusMl', output: 'status_ml' },
  { input: 'permalink', output: 'permalink' },
  { input: 'price', output: 'price' },
  { input: 'availableQuantity', output: 'available_quantity' },
  { input: 'sellerSku', output: 'seller_sku' },
  { input: 'pictures', output: 'pictures', clone: 'array' },
  { input: 'attributes', output: 'attributes', clone: 'array' },
  { input: 'plainText', output: 'plain_text' },
  { input: 'descriptionData', output: 'description_data', clone: 'record' },
  { input: 'rawData', output: 'raw_data', clone: 'record' },
  { input: 'lastSeenAt', output: 'last_seen_at' },
  { input: 'lastSyncAt', output: 'last_sync_at' },
];

const patchRecord = (
  patch: Partial<MarketplaceAdPayload>
): SupabaseRow => {
  const record: SupabaseRow = {};

  for (const field of PATCH_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(patch, field.input)) continue;

    const value = patch[field.input];
    record[field.output] =
      field.clone === 'array'
        ? asArray(value)
        : field.clone === 'record'
          ? asRecord(value)
          : value ?? null;
  }

  return record;
};

const requireValue = (value: string, field: string): string => {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} é obrigatório.`);
  return normalized;
};

export const createSupabaseMarketplaceAdAdapter = (
  client: SupabaseClient = defaultSupabase
): MarketplaceAdRegistryAdapter => ({
  async findByMlbId(input) {
    const integrationId = requireValue(input.integrationId, 'integrationId');
    const mlbId = requireValue(input.mlbId, 'mlbId');
    const { data, error } = await client
      .from('marketplace_ads')
      .select('*')
      .eq('integration_id', integrationId)
      .eq('mlb_id', mlbId);

    if (error) throw new Error(error.message);
    return ((data ?? []) as SupabaseRow[]).map(mapMarketplaceAd);
  },

  async findExact(input) {
    const integrationId = requireValue(input.integrationId, 'integrationId');
    const mlbId = requireValue(input.mlbId, 'mlbId');
    const pecaId = requireValue(input.pecaId, 'pecaId');
    const { data, error } = await client
      .from('marketplace_ads')
      .select('*')
      .eq('integration_id', integrationId)
      .eq('mlb_id', mlbId)
      .eq('peca_id', pecaId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapMarketplaceAd(data as SupabaseRow) : null;
  },

  async insertAd(payload) {
    const { data, error } = await client
      .from('marketplace_ads')
      .insert(insertRecord(payload))
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return mapMarketplaceAd(data as SupabaseRow);
  },

  async updateAd(id, patch) {
    const targetId = requireValue(id, 'id');
    const record = patchRecord(patch);
    if (Object.keys(record).length === 0) {
      throw new Error('MarketplaceAd update sem campos.');
    }

    const { data, error } = await client
      .from('marketplace_ads')
      .update(record)
      .eq('id', targetId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return mapMarketplaceAd(data as SupabaseRow);
  },

  async markDuplicates(input) {
    const principalId = requireValue(input.principalId, 'principalId');
    const mlbId = requireValue(input.mlbId, 'mlbId');
    const duplicateIds = [
      ...new Set(
        input.duplicateIds
          .map((id) => id.trim())
          .filter((id) => id && id !== principalId)
      ),
    ];
    const markedAt = new Date().toISOString();

    const { error: principalError } = await client
      .from('marketplace_ads')
      .update({
        is_duplicate: false,
        duplicate_of: null,
        duplicate_reason: null,
        duplicate_marked_at: null,
      })
      .eq('id', principalId)
      .eq('mlb_id', mlbId);

    if (principalError) throw new Error(principalError.message);
    if (duplicateIds.length === 0) return;

    const { error: duplicateError } = await client
      .from('marketplace_ads')
      .update({
        is_duplicate: true,
        duplicate_of: principalId,
        duplicate_reason: `MLB duplicado: ${mlbId}`,
        duplicate_marked_at: markedAt,
      })
      .in('id', duplicateIds)
      .eq('mlb_id', mlbId);

    if (duplicateError) throw new Error(duplicateError.message);
  },
});

export const supabaseMarketplaceAdAdapter: MarketplaceAdRegistryAdapter =
  createSupabaseMarketplaceAdAdapter();
