import type { PartCanonical } from '../modules/importer/schemas/part.schema';
import { resolveLocation } from '../services/resolveLocation';

export interface MongoIntegration {
  id: string;
  status: 'active' | 'inactive';
  channel?: string | null;
  name?: string | null;
  user_id?: string | null;
  mlb_id?: string | null;
}

export interface MongoInventoryPayload {
  store_id: string;

  // Identifiers
  id_int?: number | null;
  id_string?: string | null;
  code?: string | null;
  tag_code?: string | null;

  // Marketplace fields
  marketplace_name?: string | null;
  marketplace_name_normalized?: string | null;

  // Stock / status
  stock_quantity: number;
  status: 'DISPONIVEL' | 'SEM_ESTOQUE';

  // Price
  price: number;
  marketplace_price: number;

  // Location
  storage_location_id?: string | null;
  storage_location_name?: string | null;

  // Integrations map
  integrations?: Record<string, MongoIntegration> | null;

  // Images
  images: string[];
  image_count: number;

  // Defaults
  catalog_attributes: unknown[];
  use_default_price: boolean;
  part_category_name?: string | null;
  mercado_libre_brasil_category_id?: string | null;

  // Original source (lightweight)
  sourceRow?: Record<string, unknown> | undefined;
}

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
  resolvedLocation?: { _id?: string; descricao?: string } | null;
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

  // If no id provided but there are mlb ids, fill id_string with first mlb
  if (!payload.id_int && !payload.id_string) {
    const firstMlb = firstString(importedPart.mlb_ids as unknown as string[]);
    if (firstMlb) payload.id_string = firstMlb;
  }

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

  // Location: prefer provided resolvedLocation, else try resolver service, else fallback to original
  const resolved = options.resolvedLocation ?? resolveLocation(importedPart.location ?? null);
  if (resolved && resolved._id) {
    payload.storage_location_id = resolved._id;
    payload.storage_location_name = resolved.descricao ?? importedPart.location ?? null;
  } else {
    payload.storage_location_name = importedPart.location ?? null;
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
        channel: options.integration.canal ?? null,
        name: options.integration.nome ?? null,
        user_id: options.integration.mercado_livre_brasil?.user_id ?? null,
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
