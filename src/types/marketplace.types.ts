export interface MarketplaceListing {
  id: string;
  title: string | null;
  price: number | null;
  availableQuantity: number | null;
  status: string | null;
  categoryId: string | null;
  permalink: string | null;
  thumbnail: string | null;
  pictures: string[];
  sellerSku: string | null;
  catalogListing: boolean | null;
  listingType: string | null;
  raw?: unknown;
}

export interface MarketplaceListingsResult {
  listings: MarketplaceListing[];
  ids: string[];
  scrollId: string | null;
  totalLoaded: number;
}

export interface MarketplaceListingDescription {
  plainText: string | null;
  raw: unknown;
}
