import type { ExistingInventoryItem } from '../../../types/inventory.types';
import type {
  CanonicalPart,
  PartMarketplaceLink,
} from '../part.types';
import {
  asRecord,
  calculatedStatus,
  imagesFromUnknown,
  nullableNumber,
  nullableString,
  numberOrZero,
} from './mapperUtils';

type ExistingInventoryShape = ExistingInventoryItem & {
  marketplace_price?: unknown;
  images?: unknown;
  catalog_attributes?: unknown;
  part_category_name?: unknown;
  vehicle_brand_name?: unknown;
  vehicle_model_name?: unknown;
  vehicle_year?: unknown;
  vehicle_category_name?: unknown;
  package_height?: unknown;
  package_length?: unknown;
  package_width?: unknown;
  package_weight?: unknown;
  created_at?: unknown;
  integrations?: unknown;
};

const marketplaceLinks = (
  item: ExistingInventoryShape
): PartMarketplaceLink[] => {
  const links: PartMarketplaceLink[] = [];
  const integrations = asRecord(item.integrations);

  if (integrations) {
    for (const [integrationId, rawValue] of Object.entries(integrations)) {
      const value = asRecord(rawValue);
      links.push({
        marketplace: nullableString(value?.channel)
          ?? 'mercado_livre_brasil',
        integrationId,
        marketplaceId: nullableString(value?.mlb_id),
        status: nullableString(value?.status),
        raw: rawValue,
      });
    }
  }

  const marketplaceId = nullableString(
    item.id_string ?? item.primary_anuncio_mlb_id
  );
  if (
    marketplaceId &&
    !links.some((link) => link.marketplaceId === marketplaceId)
  ) {
    links.push({
      marketplace: 'mercado_livre_brasil',
      marketplaceId,
    });
  }

  return links;
};

export const fromExistingInventoryItem = (
  item: ExistingInventoryItem
): CanonicalPart => {
  const source = item as ExistingInventoryShape;
  const stockQuantity = numberOrZero(item.stock_quantity);
  const title = nullableString(
    item.title ?? item.marketplace_name ?? item.name ?? item.code
  ) ?? '';

  return {
    identity: {
      id: nullableString(item.id),
      storeId: String(item.store_id),
      idInt: nullableNumber(item.id_int),
      idString: nullableString(item.id_string),
      code: nullableString(item.code),
      sku: nullableString(item.sku ?? item.code),
      tagCode: nullableString(item.tag_code),
      title,
      marketplaceName: nullableString(item.marketplace_name),
    },
    commercial: {
      stockQuantity,
      price: numberOrZero(item.price),
      marketplacePrice: nullableNumber(source.marketplace_price),
      status: calculatedStatus(stockQuantity, item.deleted, item.status),
    },
    organization: {
      locationId: nullableString(item.storage_location_id),
      locationName: nullableString(
        item.storage_location_name ?? item.location
      ),
    },
    content: {
      description: nullableString(item.description),
      catalogAttributes: Array.isArray(source.catalog_attributes)
        ? [...source.catalog_attributes]
        : [],
    },
    marketplace: marketplaceLinks(source),
    images: imagesFromUnknown(source.images, 'system'),
    vehicle: {
      brandName: nullableString(source.vehicle_brand_name),
      modelName: nullableString(source.vehicle_model_name),
      year: nullableString(source.vehicle_year),
      type: nullableString(source.vehicle_category_name),
    },
    category: {
      id: nullableString(item.part_category_id),
      name: nullableString(source.part_category_name),
      mercadoLivreCategoryId: nullableString(
        item.mercado_libre_brasil_category_id
      ),
    },
    dimensions: {
      packageHeight: nullableNumber(source.package_height),
      packageLength: nullableNumber(source.package_length),
      packageWidth: nullableNumber(source.package_width),
      packageWeight: nullableNumber(source.package_weight),
    },
    metadata: {
      source: 'supabase',
      createdAt: nullableString(source.created_at),
      updatedAt: nullableString(item.updated_at),
      raw: item.raw ?? item,
    },
  };
};

export default fromExistingInventoryItem;
