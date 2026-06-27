import type { Document } from 'mongodb';
import type { ImportWriteTarget } from '../types';
import type { ComparableImportRow, EnrichmentAdSnapshot, EnrichmentComparisonSnapshot } from './types';

export type EnrichmentAdFetchResult =
  | { status: 'found'; data: Document }
  | { status: 'no_access' }
  | { status: 'not_found' }
  | { status: 'fetch_error'; error?: string };

export interface ResolveEnrichmentInput {
  row: ComparableImportRow;
  integrationId: string;
  storeId: string;
  targetName: 'supabase' | 'mongo';
  target: Pick<ImportWriteTarget, 'findPartCategory'>;
  allowExternalReads?: boolean;
  fetchAd?: (mlbId: string) => Promise<EnrichmentAdFetchResult>;
}

const asString = (value: unknown): string | null =>
  value === null || value === undefined || String(value).trim() === ''
    ? null
    : String(value).trim();

const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

const getPayloadString = (row: ComparableImportRow, key: string): string | null =>
  asString(row.payload?.[key]);

const getPayloadNumberOrString = (row: ComparableImportRow, key: string): number | string | null => {
  const value = row.payload?.[key];
  return asNumber(value) ?? asString(value);
};

const mapFoundAd = (mlbId: string, data: Document): EnrichmentAdSnapshot => ({
  mlbId,
  status: 'found',
  found: true,
  noAccess: false,
  notFound: false,
  title: asString(data.title),
  price: asNumber(data.price),
  availableQuantity: asNumber(data.available_quantity),
  categoryId: asString(data.category_id),
  permalink: asString(data.permalink),
  pictureCount: asArray(data.pictures).length,
  attributeCount: asArray(data.attributes).length,
  thumbnail: asString(data.thumbnail),
  dateCreated: asString(data.date_created),
  lastUpdated: asString(data.last_updated),
});

const mapMissingAd = (
  mlbId: string,
  status: 'no_access' | 'not_found' | 'fetch_error'
): EnrichmentAdSnapshot => ({
  mlbId,
  status,
  found: false,
  noAccess: status === 'no_access',
  notFound: status === 'not_found',
  title: null,
  price: null,
  availableQuantity: null,
  categoryId: null,
  permalink: null,
  pictureCount: 0,
  attributeCount: 0,
  thumbnail: null,
  dateCreated: null,
  lastUpdated: null,
});

export const resolveEnrichmentForComparison = async (
  input: ResolveEnrichmentInput
): Promise<EnrichmentComparisonSnapshot> => {
  const warnings = new Set<string>();
  const ads: EnrichmentAdSnapshot[] = [];
  let mlCategoryId: string | null = null;

  for (const mlbId of input.row.mlb_ids ?? []) {
    if (!input.allowExternalReads || !input.fetchAd) {
      continue;
    }

    const result = await input.fetchAd(mlbId);
    if (result.status === 'found') {
      const ad = mapFoundAd(mlbId, result.data);
      ads.push(ad);
      mlCategoryId ??= ad.categoryId;
      continue;
    }

    ads.push(mapMissingAd(mlbId, result.status));
    warnings.add(result.status === 'fetch_error' ? `ad_fetch_error:${mlbId}` : `${result.status === 'no_access' ? 'ad_no_access' : 'ad_not_found'}:${mlbId}`);
  }

  const sourceCategoryId = getPayloadString(input.row, 'mercado_libre_brasil_category_id');
  const finalCategoryId = sourceCategoryId ?? mlCategoryId;
  const part = finalCategoryId
    ? await input.target.findPartCategory({ categoryId: finalCategoryId })
    : null;
  const partDoc = part?.raw ?? null;

  if (finalCategoryId && !partDoc) {
    warnings.add(`category_pending:${finalCategoryId}`);
  }

  const sheetImages = asArray(input.row.payload?.images).map(String).filter(Boolean);
  const mlImages = ads.flatMap((ad) => ad.found ? [] : []);

  return {
    targetName: input.targetName,
    row: input.row.row,
    code: input.row.code,
    id_int: input.row.id_int,
    id_string: input.row.id_string,
    mlb_ids: input.row.mlb_ids ?? [],
    category: {
      sourceCategoryId,
      mlCategoryId,
      finalCategoryId,
      partCategoryFound: Boolean(partDoc),
      partCategoryId: part ? part.id : getPayloadString(input.row, 'part_category_id'),
      partCategoryName: asString(partDoc?.nome ?? input.row.payload?.part_category_name),
      mercadoLibreBrasilCategoryId: asString(partDoc?.MLB_categoria_id ?? finalCategoryId),
      pendingReason: finalCategoryId && !partDoc ? 'category_pending' : null,
    },
    catalog: {
      attributes: asArray(partDoc?.catalogo_attributes ?? input.row.payload?.catalog_attributes),
      missingRequiredAttributes: [],
      source: partDoc ? 'parte' : (input.row.payload?.catalog_attributes ? 'payload' : null),
    },
    package: {
      height: partDoc?.embalagemAltura ?? partDoc?.altura ?? getPayloadNumberOrString(input.row, 'package_height'),
      width: partDoc?.embalagemLargura ?? partDoc?.largura ?? getPayloadNumberOrString(input.row, 'package_width'),
      length: partDoc?.embalagemComprimento ?? partDoc?.comprimento ?? getPayloadNumberOrString(input.row, 'package_length'),
      weight: partDoc?.embalagemPeso ?? partDoc?.peso ?? getPayloadNumberOrString(input.row, 'package_weight'),
      source: partDoc ? 'parte' : 'payload',
    },
    ads,
    images: {
      source: sheetImages.length > 0 ? 'sheet' : (mlImages.length > 0 ? 'mercado_livre' : null),
      urls: sheetImages,
      count: sheetImages.length,
    },
    warnings: Array.from(new Set([...(input.row.warnings ?? []), ...warnings])).sort(),
  };
};
