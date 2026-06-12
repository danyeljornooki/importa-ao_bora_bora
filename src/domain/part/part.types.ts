export interface PartIdentity {
  id?: string | null;
  storeId: string;
  idInt?: number | null;
  idString?: string | null;
  code?: string | null;
  sku?: string | null;
  tagCode?: string | null;
  title: string;
  marketplaceName?: string | null;
}

export interface PartCommercial {
  stockQuantity: number;
  price: number;
  marketplacePrice?: number | null;
  status: 'DISPONIVEL' | 'SEM_ESTOQUE' | 'deleted' | string;
  useDefaultPrice?: boolean;
}

export interface PartOrganization {
  locationId?: string | null;
  locationName?: string | null;
  markers?: string[];
}

export interface PartContent {
  description?: string | null;
  catalogAttributes?: unknown[];
}

export interface PartDimensions {
  packageHeight?: number | null;
  packageLength?: number | null;
  packageWidth?: number | null;
  packageWeight?: number | null;
}

export interface PartMarketplaceLink {
  marketplace: 'mercado_livre_brasil' | 'shopee' | string;
  integrationId?: string | null;
  marketplaceId?: string | null;
  status?: string | null;
  permalink?: string | null;
  title?: string | null;
  price?: number | null;
  stockQuantity?: number | null;
  raw?: unknown;
}

export interface PartImage {
  id?: string | null;
  url: string;
  thumbnailUrl?: string | null;
  source: 'mercado_livre' | 'sheet' | 'upload' | 'system' | string;
  order?: number | null;
}

export interface PartVehicle {
  brandName?: string | null;
  modelName?: string | null;
  year?: string | number | null;
  type?: string | null;
}

export interface PartCategory {
  id?: string | null;
  name?: string | null;
  mercadoLivreCategoryId?: string | null;
  shopeeCategoryId?: string | null;
}

export interface PartMetadata {
  source?: 'sheet' | 'mongo' | 'supabase' | 'symfony' | 'manual' | string;
  sourceRow?: unknown;
  createdAt?: string | null;
  updatedAt?: string | null;
  raw?: unknown;
}

export interface CanonicalPart {
  identity: PartIdentity;
  commercial: PartCommercial;
  organization: PartOrganization;
  content: PartContent;
  marketplace: PartMarketplaceLink[];
  images: PartImage[];
  vehicle?: PartVehicle | null;
  category?: PartCategory | null;
  dimensions?: PartDimensions | null;
  metadata: PartMetadata;
}
