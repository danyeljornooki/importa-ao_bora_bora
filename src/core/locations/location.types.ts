export interface StorageLocationPathItem {
  storage_location_id: string;
  name: string;
  abbreviation?: string | null;
  storage_location_type_id?: string | null;
  storage_location_type_name?: string | null;
  icon_key?: string | null;
  color_key?: string | null;
}

export interface StorageLocation {
  id?: string;
  _id?: string;
  store_id: string;
  name: string;
  abbreviation?: string | null;
  storage_location_type_id?: string | null;
  storage_location_type_name?: string | null;
  icon_key?: string | null;
  color_key?: string | null;
  path_text?: string | null;
  location_path_text?: string | null;
  location_path_key?: string | null;
  location_path_names?: string[];
  location_path_slugs?: string[];
  path_ids?: string[];
  path_items?: StorageLocationPathItem[];
  status?: string;
}

export interface ResolvedStorageLocation {
  found: boolean;
  created: boolean;
  location: StorageLocation;
  source: 'linked';
}

export interface LocationInput {
  storeId: string;
  rawLocation: string;
  createdBy?: string | null;
}

export interface NormalizedLocationInput {
  original: string;
  normalizedText: string;
  parts: string[];
  pathKey: string;
}

export interface StorageLocationPayload {
  store_id: string;
  name: string;
  description: string;
  status: 'active';
  created_by: string;
  search_name_ngrams: string[];
  location_path_names: string[];
  location_path_slugs: string[];
  location_path_key: string;
  location_path_prefixes: string[];
  location_path_text: string;
  location_path_depth: number;
  location_path_character_count: number;
  path_text: string;
  level: number;
  abbreviation: string | null;
  stock_capacity: number;
  volume_total: number;
  quantity_pieces: number;
  volume_used: number;
  inferred_quantity_pieces: number;
  inferred_volume_used: number;
  combined_quantity_pieces: number;
  combined_volume_used: number;
  quantity_max_pieces: number;
  vehicle_brand_ids: string[];
  part_category_ids: string[];
  rule_overrides: unknown[];
}
