import type {
  CanonicalPart,
  PartMarketplaceLink,
} from '../part.types';

const normalizeName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const integrationKey = (link: PartMarketplaceLink): string =>
  link.integrationId
  ?? `${link.marketplace}:${link.marketplaceId ?? ''}`;

const buildIntegrations = (
  links: PartMarketplaceLink[]
): Record<string, unknown> | null => {
  if (links.length === 0) return null;

  return Object.fromEntries(
    links.map((link) => [
      integrationKey(link),
      {
        id: link.integrationId ?? null,
        status: link.status ?? 'active',
        channel: link.marketplace,
        mlb_id:
          link.marketplace === 'mercado_livre_brasil'
            ? link.marketplaceId ?? null
            : null,
        marketplace_id: link.marketplaceId ?? null,
        permalink: link.permalink ?? null,
        title: link.title ?? null,
        price: link.price ?? null,
        stock_quantity: link.stockQuantity ?? null,
        raw: link.raw ?? null,
      },
    ])
  );
};

export const toSupabaseInventoryShape = (
  part: CanonicalPart
): Record<string, unknown> => {
  const marketplaceName =
    part.identity.marketplaceName ?? part.identity.title;

  return {
    store_id: part.identity.storeId,
    id_int: part.identity.idInt ?? null,
    id_string: part.identity.idString ?? null,
    code: part.identity.code ?? null,
    tag_code: part.identity.tagCode ?? null,
    marketplace_name: marketplaceName,
    marketplace_name_normalized: normalizeName(marketplaceName),
    stock_quantity: part.commercial.stockQuantity,
    price: part.commercial.price,
    marketplace_price:
      part.commercial.marketplacePrice ?? part.commercial.price,
    status: part.commercial.status,
    use_default_price: part.commercial.useDefaultPrice ?? false,
    storage_location_id: part.organization.locationId ?? null,
    storage_location_name: part.organization.locationName ?? null,
    description: part.content.description ?? null,
    images: part.images.map((image, index) => ({
      url: image.url,
      thumbnail_url: image.thumbnailUrl ?? image.url,
      source: image.source,
      ordem: image.order ?? index,
    })),
    image_count: part.images.length,
    catalog_attributes: part.content.catalogAttributes
      ? [...part.content.catalogAttributes]
      : [],
    mercado_libre_brasil_category_id:
      part.category?.mercadoLivreCategoryId ?? null,
    part_category_id: part.category?.id ?? null,
    part_category_name: part.category?.name ?? null,
    vehicle_brand_name: part.vehicle?.brandName ?? null,
    vehicle_model_name: part.vehicle?.modelName ?? null,
    vehicle_year: part.vehicle?.year ?? null,
    vehicle_category_name: part.vehicle?.type ?? null,
    package_height: part.dimensions?.packageHeight ?? null,
    package_length: part.dimensions?.packageLength ?? null,
    package_width: part.dimensions?.packageWidth ?? null,
    package_weight: part.dimensions?.packageWeight ?? null,
    integrations: buildIntegrations(part.marketplace),
  };
};

export default toSupabaseInventoryShape;
