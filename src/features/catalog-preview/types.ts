export interface CatalogPicture {
  id?: string;
  url?: string;
  secure_url?: string;
  size?: string;
  max_size?: string;
}

export type CatalogStockFilter = 'all' | 'in_stock' | 'out_of_stock';
export type CatalogLocationFilter = 'all' | 'with_location' | 'without_location';
export type CatalogImageFilter = 'all' | 'with_image' | 'without_image';
export type CatalogAdFilter = 'all' | 'with_mlb' | 'without_mlb';
export type CatalogSort = 'recent' | 'updated' | 'name_asc' | 'price_asc' | 'price_desc';

export interface CatalogPreviewFilters {
  storeId?: string;
  search?: string;
  status?: string;
  stock?: CatalogStockFilter;
  location?: CatalogLocationFilter;
  image?: CatalogImageFilter;
  ad?: CatalogAdFilter;
  sort?: CatalogSort;
  page: number;
  pageSize: number;
}

export interface CatalogPreviewPart {
  id: string;
  storeId: string;
  title: string;
  code: string | null;
  displayCode: string;
  stockQuantity: number | null;
  price: number | null;
  marketplacePrice: number | null;
  status: string | null;
  categoryName: string | null;
  locationName: string | null;
  vehicleLabel: string | null;
  description: string | null;
  primaryMlbId: string | null;
  primaryAdStatus: string | null;
  imageCount: number;
  mainImageUrl: string | null;
  pictures: CatalogPicture[];
  createdAt: string | null;
  updatedAt: string | null;
  rawInventory: Record<string, unknown>;
  selectedAd: CatalogPreviewAd | null;
  ads: CatalogPreviewAd[];
}

export interface CatalogPreviewAd {
  id: string;
  pecaId: string | null;
  mlbId: string | null;
  title: string | null;
  statusMl: string | null;
  permalink: string | null;
  price: number | null;
  availableQuantity: number | null;
  pictures: CatalogPicture[];
  attributes: unknown[];
  rawData: Record<string, unknown>;
  plainText: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CatalogPreviewListResult {
  items: CatalogPreviewPart[];
  total: number | null;
  page: number;
  pageSize: number;
}

export type CatalogViewMode = 'list' | 'grid';
