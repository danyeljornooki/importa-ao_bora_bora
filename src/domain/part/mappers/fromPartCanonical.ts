import type { PartCanonical } from '../../../modules/importer/schemas/part.schema';
import type { CanonicalPart } from '../part.types';
import {
  calculatedStatus,
  imagesFromUrls,
  marketplaceLinksFromMlbIds,
  nullableNumber,
  nullableString,
  numberOrZero,
} from './mapperUtils';

export interface FromPartCanonicalInput {
  part: PartCanonical;
  storeId: string;
}

export const fromPartCanonical = ({
  part,
  storeId,
}: FromPartCanonicalInput): CanonicalPart => {
  const record = part as PartCanonical & {
    marketplace_price?: unknown;
    use_default_price?: unknown;
  };
  const stockQuantity = numberOrZero(part.stock_quantity);
  const code = nullableString(part.code);
  const marketplaceName = nullableString(
    part.marketplace_name ?? part.title
  );

  return {
    identity: {
      id: nullableString(part.id ?? part._id),
      storeId: String(storeId),
      idInt: nullableNumber(part.id_int),
      idString: nullableString(part.id_string),
      code,
      sku: code,
      tagCode: nullableString(part.tag_code),
      title: nullableString(part.title ?? part.marketplace_name ?? code) ?? '',
      marketplaceName,
    },
    commercial: {
      stockQuantity,
      price: numberOrZero(part.price),
      marketplacePrice: nullableNumber(record.marketplace_price),
      status: calculatedStatus(stockQuantity, part.deleted, part.status),
      useDefaultPrice:
        typeof record.use_default_price === 'boolean'
          ? record.use_default_price
          : undefined,
    },
    organization: {
      locationName: nullableString(part.location),
    },
    content: {
      description: nullableString(part.description),
      catalogAttributes: [],
    },
    marketplace: marketplaceLinksFromMlbIds(part.mlb_ids),
    images: imagesFromUrls(part.image_urls, 'sheet'),
    vehicle: null,
    category: null,
    dimensions: null,
    metadata: {
      source: 'sheet',
      sourceRow: part.sourceRow,
      updatedAt: nullableString(part.updated_at),
      raw: part,
    },
  };
};

export default fromPartCanonical;
