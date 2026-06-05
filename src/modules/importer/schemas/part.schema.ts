export interface PartCanonical {
  _id?: string | number | null;
  id?: string | number | null;
  store_id?: string | number | null;
  code?: string | null;
  tag_code?: string | null;
  price: number;
  stock_quantity: number | null;
  location?: string | null;
  title?: string;
  marketplace_name?: string | null;
  description?: string;
  mlb_ids?: string[];
  image_urls?: string[];
  id_int?: string | number | null;
  id_string?: string | null;
  status?: string | null;
  deleted?: boolean | null;
  updated_at?: string | null;
  sourceRow?: Record<string, unknown>;
  import_metadata?: {
  warnings?: string[];
}
}

export type RawPartRow = Record<string, unknown>;

export const requiredPartFields = ['code', 'price'] as const;
