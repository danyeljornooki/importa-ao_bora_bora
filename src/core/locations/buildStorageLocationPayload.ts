import {
  buildLocationPathPrefixes,
  buildLocationPathSlugs,
  buildLocationPathText,
} from './buildLocationPath';
import type {
  LocationInput,
  StorageLocationPayload,
  StorageLocationPathItem,
} from './location.types';
import { normalizeLocationInput } from './normalizeLocationInput';

const inferTypeName = (name: string): string => {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (normalized.includes('PRATELEIRA')) return 'PRATELEIRA';
  if (normalized.includes('CAIXA') || /\bCX\b/.test(normalized)) return 'CAIXA';
  if (normalized.includes('SETOR')) return 'SETOR';
  if (normalized.includes('VAO')) return 'VAO';
  if (normalized.includes('ANDAR')) return 'ANDAR';
  return 'LOCALIZACAO';
};

const buildNgrams = (value: string): string[] => {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const tokens = normalized.split(/\s+/).filter(Boolean);
  return Array.from(new Set(tokens.flatMap((token) => {
    const grams: string[] = [];
    for (let size = 1; size <= token.length; size += 1) {
      grams.push(token.slice(0, size));
    }
    return grams;
  })));
};

export const buildStorageLocationPayload = (
  input: LocationInput,
  now: Date = new Date()
): StorageLocationPayload | null => {
  const normalized = normalizeLocationInput(input.rawLocation);
  if (!input.storeId?.trim() || normalized.parts.length === 0) return null;

  const location_path_names = normalized.parts;
  const location_path_slugs = buildLocationPathSlugs(location_path_names);
  const location_path_text = buildLocationPathText(location_path_names);
  const leafName = location_path_names[location_path_names.length - 1];
  const leafSlug = location_path_slugs[location_path_slugs.length - 1] ?? '';
  const pathItem: StorageLocationPathItem = {
    storage_location_id: '',
    name: leafName,
    abbreviation: leafSlug ? leafSlug.toUpperCase() : null,
    storage_location_type_id: null,
    storage_location_type_name: inferTypeName(leafName),
    icon_key: null,
    color_key: null,
  };

  return {
    store_id: input.storeId,
    name: leafName,
    description: '',
    status: 'active',
    created_by: input.createdBy?.trim() || input.storeId,
    created_at: now.toISOString(),
    search_name_ngrams: buildNgrams(location_path_text),
    location_path_names,
    location_path_slugs,
    location_path_key: normalized.pathKey,
    location_path_prefixes: buildLocationPathPrefixes(location_path_slugs),
    location_path_text,
    location_path_depth: location_path_names.length,
    location_path_character_count: location_path_text.length,
    path: location_path_text,
    path_ids: [],
    path_text: location_path_text,
    path_items: [pathItem],
    level: Math.max(0, location_path_names.length - 1),
    abbreviation: leafSlug ? leafSlug.toUpperCase() : null,
    stock_capacity: 0,
    volume_total: 0,
    quantity_pieces: 0,
    volume_used: 0,
    inferred_quantity_pieces: 0,
    inferred_volume_used: 0,
    combined_quantity_pieces: 0,
    combined_volume_used: 0,
    quantity_max_pieces: 0,
    vehicle_brand_ids: [],
    part_category_ids: [],
    rule_overrides: [],
  };
};
