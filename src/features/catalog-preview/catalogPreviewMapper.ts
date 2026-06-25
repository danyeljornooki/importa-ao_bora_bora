import { firstPictureUrl, parseAdPictures } from './parseAdPictures';
import type { CatalogPreviewAd, CatalogPreviewPart } from './types';

type Row = Record<string, unknown>;

const asString = (value: unknown): string | null =>
  value === null || value === undefined || String(value).trim() === ''
    ? null
    : String(value).trim();

const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asRecord = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Row
    : {};

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const isMlb = (value: string | null): boolean =>
  Boolean(value?.toUpperCase().startsWith('MLB'));

const displayCodeFor = (row: Row): string => {
  const code = asString(row.code);
  const idInt = asString(row.id_int);
  const idString = asString(row.id_string);
  const primaryMlbId = asString(row.primary_anuncio_mlb_id);
  return code ?? idInt ?? idString ?? primaryMlbId ?? 'Código não informado';
};

export const vehicleLabelFor = (row: Row): string | null => {
  const parts = [
    asString(row.vehicle_brand_name),
    asString(row.vehicle_model_name),
    asString(row.vehicle_year),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
};

export const mapCatalogPreviewAd = (row: Row): CatalogPreviewAd => {
  const rawData = asRecord(row.raw_data);
  return {
    id: asString(row.id) ?? '',
    pecaId: asString(row.peca_id),
    mlbId: asString(row.mlb_id),
    title: asString(row.title),
    statusMl: asString(row.status_ml),
    permalink: asString(row.permalink),
    price: asNumber(row.price),
    availableQuantity: asNumber(row.available_quantity),
    pictures: parseAdPictures(row.pictures),
    attributes: asArray(row.attributes),
    rawData,
    plainText: asString(row.plain_text),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
};

const selectPreferredAd = (
  row: Row,
  ads: CatalogPreviewAd[]
): CatalogPreviewAd | null => {
  const primaryMlbId = asString(row.primary_anuncio_mlb_id);
  if (primaryMlbId) {
    const exact = ads.find((ad) => ad.mlbId === primaryMlbId);
    if (exact) return exact;
  }
  return ads[0] ?? null;
};

export const mapCatalogPreviewPart = (
  row: Row,
  adRows: Row[] = []
): CatalogPreviewPart => {
  const ads = adRows.map(mapCatalogPreviewAd);
  const selectedAd = selectPreferredAd(row, ads);
  const pictures = selectedAd?.pictures ?? [];
  const idString = asString(row.id_string);
  const primaryMlbId = asString(row.primary_anuncio_mlb_id);
  const mlbId = primaryMlbId ?? (isMlb(idString) ? idString : null);

  return {
    id: asString(row.id) ?? '',
    storeId: asString(row.store_id) ?? '',
    title: asString(row.marketplace_name) ?? 'Peça sem título',
    code: asString(row.code),
    displayCode: displayCodeFor(row),
    stockQuantity: asNumber(row.stock_quantity),
    price: asNumber(row.price),
    marketplacePrice: asNumber(row.marketplace_price),
    status: asString(row.status),
    categoryName: asString(row.part_category_name),
    locationName: asString(row.storage_location_name),
    vehicleLabel: vehicleLabelFor(row),
    description: asString(row.description),
    primaryMlbId: mlbId,
    primaryAdStatus: asString(row.primary_anuncio_status) ?? selectedAd?.statusMl ?? null,
    imageCount: asNumber(row.image_count) ?? pictures.length,
    mainImageUrl: firstPictureUrl(pictures, selectedAd?.rawData),
    pictures,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    rawInventory: row,
    selectedAd,
    ads,
  };
};

export const conditionLabelFromAd = (ad: CatalogPreviewAd | null): string => {
  const attribute = ad?.attributes.find((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    return (item as Row).id === 'ITEM_CONDITION';
  }) as Row | undefined;

  return asString(attribute?.value_name) ?? asString(attribute?.value_id) ?? 'Não informado';
};
