export interface MarketplaceAd {
  id: string;
  storeId: string;
  integrationId: string;
  pecaId?: string | null;
  marketplace: 'mercado_livre_brasil' | string;
  mlbId: string;
  title?: string | null;
  categoryId?: string | null;
  catalogProductId?: string | null;
  statusMl?: string | null;
  permalink?: string | null;
  price?: number | null;
  availableQuantity?: number | null;
  sellerSku?: string | null;
  pictures: unknown[];
  attributes: unknown[];
  plainText?: string | null;
  descriptionData: Record<string, unknown>;
  rawData: Record<string, unknown>;
  isDuplicate: boolean;
  duplicateOf?: string | null;
  duplicateReason?: string | null;
  duplicateMarkedAt?: string | null;
  lastSeenAt?: string | null;
  lastSyncAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface MarketplaceAdPayload {
  storeId: string;
  integrationId: string;
  pecaId?: string | null;
  marketplace?: 'mercado_livre_brasil' | string;
  mlbId: string;
  title?: string | null;
  categoryId?: string | null;
  catalogProductId?: string | null;
  statusMl?: string | null;
  permalink?: string | null;
  price?: number | null;
  availableQuantity?: number | null;
  sellerSku?: string | null;
  pictures?: unknown[];
  attributes?: unknown[];
  plainText?: string | null;
  descriptionData?: Record<string, unknown>;
  rawData?: Record<string, unknown>;
  lastSeenAt?: string | null;
  lastSyncAt?: string | null;
}

export interface MarketplaceAdRegistryAdapter {
  findByMlbId(input: {
    integrationId: string;
    mlbId: string;
  }): Promise<MarketplaceAd[]>;

  findExact(input: {
    integrationId: string;
    mlbId: string;
    pecaId: string;
  }): Promise<MarketplaceAd | null>;

  insertAd(payload: MarketplaceAdPayload): Promise<MarketplaceAd>;

  updateAd(
    id: string,
    patch: Partial<MarketplaceAdPayload>
  ): Promise<MarketplaceAd>;

  markDuplicates(input: {
    principalId: string;
    duplicateIds: string[];
    mlbId: string;
  }): Promise<void>;
}
