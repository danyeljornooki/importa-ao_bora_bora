import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../../adapters/supabase/supabaseClient';
import { mapCatalogPreviewPart } from './catalogPreviewMapper';
import type {
  CatalogPreviewFilters,
  CatalogPreviewListResult,
  CatalogPreviewPart,
} from './types';

type Row = Record<string, unknown>;

const INVENTORY_SELECT = `
  id,
  store_id,
  id_int,
  id_string,
  code,
  tag_code,
  marketplace_name,
  marketplace_name_normalized,
  vehicle_brand_name,
  vehicle_model_name,
  vehicle_year,
  vehicle_category_name,
  stock_quantity,
  price,
  marketplace_price,
  use_default_price,
  status,
  part_category_id,
  part_category_name,
  mercado_libre_brasil_category_id,
  storage_location_id,
  storage_location_name,
  description,
  catalog_attributes,
  primary_anuncio_id,
  primary_anuncio_mlb_id,
  primary_anuncio_status,
  image_count,
  deleted,
  deleted_at,
  created_at,
  updated_at
`;

const AD_SELECT = `
  id,
  store_id,
  integration_id,
  peca_id,
  marketplace,
  mlb_id,
  title,
  category_id,
  status_ml,
  permalink,
  price,
  available_quantity,
  seller_sku,
  pictures,
  attributes,
  plain_text,
  raw_data,
  created_at,
  updated_at
`;

const pageSizeFor = (value: number): number =>
  [10, 25, 50, 100].includes(value) ? value : 10;

const text = (value: string | undefined): string =>
  value?.trim() ?? '';

const escapeSearch = (value: string): string =>
  value.replace(/[%_,]/g, ' ').trim();

const applyFilters = (query: any, filters: CatalogPreviewFilters): any => {
  let next = query.eq('deleted', false);

  const storeId = text(filters.storeId);
  if (storeId) next = next.eq('store_id', storeId);

  const status = text(filters.status);
  if (status) next = next.eq('status', status);

  const search = escapeSearch(text(filters.search));
  if (search) {
    const pattern = `%${search}%`;
    next = next.or([
      `marketplace_name.ilike.${pattern}`,
      `marketplace_name_normalized.ilike.${pattern}`,
      `code.ilike.${pattern}`,
      `id_string.ilike.${pattern}`,
      `primary_anuncio_mlb_id.ilike.${pattern}`,
    ].join(','));
  }

  if (filters.stock === 'in_stock') next = next.gt('stock_quantity', 0);
  if (filters.stock === 'out_of_stock') next = next.or('stock_quantity.is.null,stock_quantity.eq.0');

  if (filters.location === 'with_location') next = next.not('storage_location_name', 'is', null);
  if (filters.location === 'without_location') next = next.is('storage_location_name', null);

  if (filters.image === 'with_image') next = next.gt('image_count', 0);
  if (filters.image === 'without_image') next = next.or('image_count.is.null,image_count.eq.0');

  if (filters.ad === 'with_mlb') next = next.not('primary_anuncio_mlb_id', 'is', null);
  if (filters.ad === 'without_mlb') next = next.is('primary_anuncio_mlb_id', null);

  return next;
};

const applySort = (query: any, sort: CatalogPreviewFilters['sort']): any => {
  switch (sort) {
    case 'updated':
      return query.order('updated_at', { ascending: false, nullsFirst: false });
    case 'name_asc':
      return query.order('marketplace_name', { ascending: true, nullsFirst: false });
    case 'price_asc':
      return query.order('price', { ascending: true, nullsFirst: false });
    case 'price_desc':
      return query.order('price', { ascending: false, nullsFirst: false });
    case 'recent':
    default:
      return query.order('created_at', { ascending: false, nullsFirst: false });
  }
};

const groupAdsByPart = (rows: Row[]): Map<string, Row[]> => {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const pecaId = row.peca_id ? String(row.peca_id) : '';
    if (!pecaId) continue;
    grouped.set(pecaId, [...(grouped.get(pecaId) ?? []), row]);
  }
  return grouped;
};

const fetchAdsForParts = async (
  client: SupabaseClient,
  ids: string[]
): Promise<Map<string, Row[]>> => {
  if (ids.length === 0) return new Map();

  const { data, error } = await client
    .from('marketplace_ads')
    .select(AD_SELECT)
    .in('peca_id', ids);

  if (error) throw new Error(error.message);
  return groupAdsByPart((data ?? []) as Row[]);
};

export const createCatalogPreviewAdapter = (
  client: SupabaseClient = defaultSupabase
) => ({
  async listCatalogPreviewParts(
    filters: CatalogPreviewFilters
  ): Promise<CatalogPreviewListResult> {
    const page = Math.max(1, filters.page || 1);
    const pageSize = pageSizeFor(filters.pageSize);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = client
      .from('inventory_items')
      .select(INVENTORY_SELECT, { count: 'exact' });

    query = applySort(applyFilters(query, filters), filters.sort).range(from, to);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Row[];
    const ids = rows.map((row) => String(row.id)).filter(Boolean);
    const adsByPart = await fetchAdsForParts(client, ids);

    return {
      items: rows.map((row) => mapCatalogPreviewPart(row, adsByPart.get(String(row.id)) ?? [])),
      total: count,
      page,
      pageSize,
    };
  },

  async getCatalogPreviewPartById(id: string): Promise<CatalogPreviewPart | null> {
    const { data, error } = await client
      .from('inventory_items')
      .select(INVENTORY_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    const { data: adData, error: adError } = await client
      .from('marketplace_ads')
      .select(AD_SELECT)
      .eq('peca_id', id);

    if (adError) throw new Error(adError.message);

    return mapCatalogPreviewPart(data as Row, (adData ?? []) as Row[]);
  },
});

export const catalogPreviewAdapter = createCatalogPreviewAdapter();
