import type { PartCanonical } from '../modules/importer/schemas/part.schema';
import type { InventoryPersistencePayload } from '../types/inventory.types';

export interface MongoIntegration {
  id: string;
  status: 'active' | 'inactive';
  channel?: string | null;
  name?: string | null;
  user_id?: string | null;
  mlb_id?: string | null;
}

export type MongoInventoryPayload = InventoryPersistencePayload;

type Options = {
  storeId: string | number;
  integrationId?: string | number | null;
  integration?: {
    _id?: string;
    canal?: string;
    nome?: string;
    mercado_livre_brasil?: {
      user_id?: string;
    };
  } | null;
  resolvedLocation?: { id?: string; _id?: string; name?: string; location_path_text?: string | null; path_text?: string | null } | null;
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

const firstString = (arr?: unknown[] | string | null): string | null => {
  if (!arr) return null;
  if (typeof arr === 'string') return arr.trim() === '' ? null : arr.trim();
  if (Array.isArray(arr)) {
    for (const item of arr) {
      if (typeof item === 'string' && item.trim() !== '') return item.trim();
    }
  }
  return null;
};

export const buildPersistencePayload = (
  importedPart: PartCanonical,
  options: Options
): MongoInventoryPayload => {
  if (!options?.storeId || String(options.storeId).trim() === '') {
    throw new Error('storeId obrigatorio para buildPersistencePayload');
  }

  const payload: MongoInventoryPayload = {
    store_id: String(options.storeId),
    images: [],
    image_count: 0,
    catalog_attributes: [],
    use_default_price: false,
    part_category_name: null,
    mercado_libre_brasil_category_id: null,
    stock_quantity: 0,
    status: 'SEM_ESTOQUE',
    price: 0,
    marketplace_price: 0,
  };

  // Identifiers
  const idIntRaw = importedPart.id_int ?? undefined;
  if (idIntRaw !== undefined && idIntRaw !== null) {
    const asNumber = typeof idIntRaw === 'number' ? idIntRaw : Number(String(idIntRaw).trim());
    if (Number.isFinite(asNumber)) {
      payload.id_int = asNumber;
    } else {
      payload.id_string = String(idIntRaw);
    }
  }

  const explicitIdString = firstString(importedPart.id_string);
  const firstMlb = firstString(importedPart.mlb_ids as unknown as string[]);
  const idString = explicitIdString ?? firstMlb;
  if (idString) payload.id_string = idString;

  // Code/tag
  if (importedPart.code !== undefined) payload.code = importedPart.code ?? null;
  // tag_code left undefined unless consumer sets it externally

  // Marketplace name
  payload.marketplace_name = importedPart.title ?? null;
  payload.marketplace_name_normalized = normalizeName(importedPart.title ?? null);

  // Stock quantity
  const qty = importedPart.stock_quantity ?? 0;
  payload.stock_quantity = Math.max(0, typeof qty === 'number' ? (Number.isFinite(qty) ? qty : 0) : 0);
  payload.status = payload.stock_quantity > 0 ? 'DISPONIVEL' : 'SEM_ESTOQUE';

  // Price
  const price = ensureNumber(importedPart.price ?? 0, 0);
  payload.price = price;
  payload.marketplace_price = price;

  // Location: only a real resolver may provide storage_location_id.
  const resolved = options.resolvedLocation ?? null;
  const resolvedId = resolved?.id ?? resolved?._id;
  if (resolved && resolvedId) {
    payload.storage_location_id = resolvedId;
    payload.storage_location_name =
      resolved.location_path_text ?? resolved.path_text ?? resolved.name ?? importedPart.location ?? null;
    payload.storage_location_source = 'linked';
  } else {
    payload.storage_location_name = importedPart.location ?? null;
    if (importedPart.location?.trim()) {
      payload.storage_location_source = 'pending';
    }
  }

  // Integrations
  const integrationKey = options.integrationId ?? options.integration?._id;
  if (integrationKey !== undefined && integrationKey !== null && String(integrationKey).trim() !== '') {
    const key = String(integrationKey);
    const mlbId = firstString(importedPart.mlb_ids as unknown as string[]);
    payload.integrations = {
      [key]: {
        id: key,
        status: 'active',
        channel: options.integration?.canal ?? null,
        name: options.integration?.nome ?? null,
        user_id: options.integration?.mercado_livre_brasil?.user_id ?? null,
        mlb_id: mlbId ?? null,
      },
    };
  } else {
    payload.integrations = null;
  }

  // Images
  const imgsRaw = importedPart.image_urls ?? [];
  const imgs: string[] = Array.isArray(imgsRaw) ? imgsRaw.filter((v): v is string => !!v) : [];
  payload.images = imgs;
  payload.image_count = imgs.length;

  // Defaults already set above

  // Source row (optional helpful reference)
  if (importedPart.sourceRow) {
    payload.sourceRow = importedPart.sourceRow;
  }

  return payload;
};

export default buildPersistencePayload;
