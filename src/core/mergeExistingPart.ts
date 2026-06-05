import type { MongoInventoryPayload } from './buildPersistencePayload';

const hasValue = (v: unknown): boolean => v !== undefined && v !== null && v !== '';

const pick = <T>(...vals: Array<T | undefined | null>): T | undefined => {
  for (const v of vals) {
    if (hasValue(v)) return v as T;
  }
  return undefined;
};

const ensureNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/[^0-9.,-]/g, '');
    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');
    let processed = cleaned;
    if (hasComma && hasDot) {
      processed = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
      processed = cleaned.replace(/,/g, '.');
    }
    const parsed = Number(processed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const normalizeName = (value?: string | null): string | null => {
  if (!value) return null;
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  return normalized === '' ? null : normalized;
};

export const mergeExistingPart = (
  existingPart: MongoInventoryPayload,
  incomingPayload: MongoInventoryPayload
): MongoInventoryPayload => {
  const existing = existingPart || ({} as MongoInventoryPayload);
  const incoming = incomingPayload || ({} as MongoInventoryPayload);

  const merged: MongoInventoryPayload & Record<string, unknown> = {
    // start from existing to preserve fields
    ...existing,
  } as any;

  // Identifiers: incoming -> existing
  if (hasValue(incoming.id_int)) merged.id_int = incoming.id_int ?? null;
  else merged.id_int = existing.id_int ?? undefined;

  if (hasValue(incoming.id_string)) merged.id_string = incoming.id_string ?? null;
  else merged.id_string = existing.id_string ?? undefined;

  merged.code = hasValue(incoming.code) ? (incoming.code as string | null) : existing.code ?? null;
  merged.tag_code = hasValue(incoming.tag_code) ? (incoming.tag_code as string | null) : existing.tag_code ?? null;

  // marketplace_name
  merged.marketplace_name = pick(incoming.marketplace_name, existing.marketplace_name) ?? null;
  merged.marketplace_name_normalized = normalizeName(merged.marketplace_name ?? null);

  // vehicle fields: preserve existing when incoming empty (fields may not exist in type)
  const vehicleFields = ['vehicle_brand_name', 'vehicle_model_name', 'vehicle_year', 'vehicle_category_name'];
  for (const vf of vehicleFields) {
    if (hasValue((incoming as any)[vf])) merged[vf] = (incoming as any)[vf];
    else if (hasValue((existing as any)[vf])) merged[vf] = (existing as any)[vf];
  }

  // stock_quantity: incoming if exists, else existing or 0. Never negative.
  const incomingQty = hasValue(incoming.stock_quantity) ? ensureNumber(incoming.stock_quantity, 0) : undefined;
  const existingQty = hasValue(existing.stock_quantity) ? ensureNumber(existing.stock_quantity, 0) : 0;
  merged.stock_quantity = Math.max(0, incomingQty !== undefined ? incomingQty : existingQty);

  // price and marketplace_price: incoming -> existing -> 0
  const priceVal = hasValue(incoming.price)
    ? ensureNumber(incoming.price, 0)
    : hasValue(existing.price)
    ? ensureNumber(existing.price, 0)
    : 0;
  merged.price = priceVal;
  merged.marketplace_price = priceVal;

  // status: based on stock_quantity
  merged.status = merged.stock_quantity > 0 ? 'DISPONIVEL' : 'SEM_ESTOQUE';

  // description: only update if incoming has value
  if (hasValue((incoming as any)['description'])) merged['description'] = (incoming as any)['description'];
  else if (hasValue((existing as any)['description'])) merged['description'] = (existing as any)['description'];

  // categories: priority list
  const chosenCategory = pick(
    (incoming as any).mercado_libre_brasil_category_id,
    (incoming as any).part_category_id,
    (existing as any).mercado_libre_brasil_category_id,
    (existing as any).part_category_id
  );
  if (hasValue(chosenCategory)) {
    merged.mercado_libre_brasil_category_id = String(chosenCategory);
    merged.part_category_id = String(chosenCategory);
  } else {
    if (hasValue((existing as any).mercado_libre_brasil_category_id)) merged.mercado_libre_brasil_category_id = (existing as any).mercado_libre_brasil_category_id;
    if (hasValue((existing as any).part_category_id)) merged.part_category_id = (existing as any).part_category_id;
  }

  // location: incoming -> existing
  if (hasValue(incoming.storage_location_id)) merged.storage_location_id = incoming.storage_location_id ?? null;
  else merged.storage_location_id = existing.storage_location_id ?? undefined;

  if (hasValue(incoming.storage_location_name)) merged.storage_location_name = incoming.storage_location_name ?? null;
  else merged.storage_location_name = existing.storage_location_name ?? null;

  // Integrations: merge shallow
  merged.integrations = {
    ...(existing.integrations || {}),
    ...(incoming.integrations || {}),
  };

  // Images & preserved fields: never remove if exist on existing
  if (Array.isArray(existing.images) && existing.images.length > 0) {
    merged.images = existing.images.slice();
    merged.image_count = existing.image_count ?? existing.images.length;
  } else {
    merged.images = Array.isArray(incoming.images) ? incoming.images.slice() : [];
    merged.image_count = Array.isArray(incoming.images) ? incoming.image_count ?? incoming.images.length : incoming.image_count ?? 0;
  }

  // catalog_attributes preserve
  if (Array.isArray(existing.catalog_attributes) && existing.catalog_attributes.length > 0) {
    merged.catalog_attributes = existing.catalog_attributes.slice();
  } else {
    merged.catalog_attributes = Array.isArray(incoming.catalog_attributes) ? incoming.catalog_attributes.slice() : [];
  }

  // preserve any primary anuncio fields if present in existing
  const preserveFields = ['primary_anuncio_id', 'primary_anuncio_mlb_id', 'primary_anuncio_status'];
  for (const pf of preserveFields) {
    if ((existing as any)[pf] !== undefined) merged[pf] = (existing as any)[pf];
    else if ((incoming as any)[pf] !== undefined) merged[pf] = (incoming as any)[pf];
  }

  // ensure stock_quantity and price are numbers
  merged.stock_quantity = Number(merged.stock_quantity ?? 0);
  merged.price = Number(merged.price ?? 0);
  merged.marketplace_price = Number(merged.marketplace_price ?? 0);

  return merged as MongoInventoryPayload;
};

export default mergeExistingPart;
