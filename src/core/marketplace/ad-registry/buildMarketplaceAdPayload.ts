import type { ImportExecutionContext } from '../../../types/integration.types';
import type { MarketplaceListing } from '../../../types/marketplace.types';
import type { MarketplaceAdPayload } from '../../../types/marketplaceAd.types';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as UnknownRecord) }
    : {};

const unwrapRawItem = (value: unknown): UnknownRecord => {
  const record = asRecord(value);
  const body = asRecord(record.body);
  return Object.keys(body).length > 0 ? body : record;
};

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? [...value] : [];

const asNullableString = (value: unknown): string | null =>
  value === null || value === undefined || String(value).trim() === ''
    ? null
    : String(value);

export function buildMarketplaceAdPayload(input: {
  context: ImportExecutionContext;
  pecaId: string;
  listing: MarketplaceListing;
  rawItem?: unknown;
  description?: {
    plainText?: string | null;
    raw?: unknown;
  };
}): MarketplaceAdPayload {
  const rawData = asRecord(input.rawItem ?? input.listing.raw);
  const raw = unwrapRawItem(input.rawItem ?? input.listing.raw);
  const pictures = Array.isArray(raw.pictures)
    ? asArray(raw.pictures)
    : [...input.listing.pictures];
  const now = new Date().toISOString();

  return {
    storeId: input.context.storeId,
    integrationId: input.context.integrationId,
    pecaId: input.pecaId,
    marketplace: 'mercado_livre_brasil',
    mlbId: input.listing.id,
    title: input.listing.title,
    categoryId: input.listing.categoryId,
    catalogProductId: asNullableString(raw.catalog_product_id),
    statusMl: input.listing.status,
    permalink: input.listing.permalink,
    price: input.listing.price,
    availableQuantity: input.listing.availableQuantity,
    sellerSku: input.listing.sellerSku,
    pictures,
    attributes: asArray(raw.attributes),
    plainText: input.description?.plainText ?? null,
    descriptionData: asRecord(input.description?.raw),
    rawData,
    lastSeenAt: now,
    lastSyncAt: now,
  };
}

export default buildMarketplaceAdPayload;
