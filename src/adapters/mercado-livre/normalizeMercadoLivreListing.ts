import type { MarketplaceListing } from '../../types/marketplace.types';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null;

const asString = (value: unknown): string | null =>
  value === null || value === undefined || String(value).trim() === ''
    ? null
    : String(value).trim();

const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asBoolean = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;

const unwrapItem = (value: unknown): UnknownRecord => {
  const record = asRecord(value);
  const body = record ? asRecord(record.body) : null;
  const item = body ?? record;

  if (!item) {
    throw new Error('Resposta de anúncio Mercado Livre inválida.');
  }

  return item;
};

const attributeValue = (
  attributes: unknown,
  attributeId: string
): string | null => {
  if (!Array.isArray(attributes)) return null;

  for (const attribute of attributes) {
    const record = asRecord(attribute);
    if (asString(record?.id)?.toUpperCase() !== attributeId) continue;

    const value = asString(record?.value_name) ?? asString(record?.value_id);
    if (value) return value;
  }

  return null;
};

const variationSellerSku = (variations: unknown): string | null => {
  if (!Array.isArray(variations)) return null;

  for (const variation of variations) {
    const record = asRecord(variation);
    const customField = asString(record?.seller_custom_field);
    if (customField) return customField;

    const sku = attributeValue(record?.attributes, 'SELLER_SKU');
    if (sku) return sku;
  }

  return null;
};

export const normalizeMercadoLivreListing = (
  raw: unknown
): MarketplaceListing => {
  const item = unwrapItem(raw);
  const id = asString(item.id);

  if (!id) {
    throw new Error('Anúncio Mercado Livre sem id.');
  }

  const pictures = Array.isArray(item.pictures)
    ? item.pictures
        .map((picture) => {
          const record = asRecord(picture);
          return asString(record?.secure_url) ?? asString(record?.url);
        })
        .filter((url): url is string => url !== null)
    : [];

  const sellerSku =
    asString(item.seller_custom_field) ??
    attributeValue(item.attributes, 'SELLER_SKU') ??
    variationSellerSku(item.variations);

  return {
    id,
    title: asString(item.title),
    price: asNumber(item.price),
    availableQuantity: asNumber(item.available_quantity),
    status: asString(item.status),
    categoryId: asString(item.category_id),
    permalink: asString(item.permalink),
    thumbnail: asString(item.thumbnail),
    pictures,
    sellerSku,
    catalogListing: asBoolean(item.catalog_listing),
    listingType: asString(item.listing_type_id),
    raw,
  };
};

export default normalizeMercadoLivreListing;
