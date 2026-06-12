import type { ImportExecutionContext } from '../../types/integration.types';
import type {
  MarketplaceListing,
  MarketplaceListingDescription,
  MarketplaceListingsResult,
} from '../../types/marketplace.types';

export { normalizeMercadoLivreListing } from './normalizeMercadoLivreListing';

export interface MarketplaceAdapter {
  scanListings(
    context: ImportExecutionContext,
    options?: {
      scrollId?: string | null;
      status?: string;
      limit?: number;
    }
  ): Promise<MarketplaceListingsResult>;

  loadListing(
    context: ImportExecutionContext,
    id: string
  ): Promise<MarketplaceListing>;

  loadListingDescription(
    context: ImportExecutionContext,
    id: string
  ): Promise<MarketplaceListingDescription>;
}

export class MarketplaceProxyError extends Error {
  constructor(
    message: string,
    public readonly status: number | null = null
  ) {
    super(message);
    this.name = 'MarketplaceProxyError';
  }
}

const proxyPost = async <T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Falha ao conectar ao proxy do Marketplace.');
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error('Proxy do Marketplace retornou JSON inválido.');
  }

  if (!response.ok) {
    const resultRecord =
      result && typeof result === 'object'
        ? result as Record<string, unknown>
        : null;
    const error =
      resultRecord && 'error' in resultRecord
        ? String(resultRecord.error)
        : `Proxy do Marketplace retornou HTTP ${response.status}.`;
    const externalStatus = Number(resultRecord?.status);
    throw new MarketplaceProxyError(
      error,
      Number.isFinite(externalStatus) ? externalStatus : response.status
    );
  }

  return result as T;
};

export const mercadoLivreAdapter: MarketplaceAdapter = {
  async scanListings(context, options = {}) {
    return proxyPost<MarketplaceListingsResult>(
      '/api/marketplace/mercado-livre/scan',
      {
        context,
        scrollId: options.scrollId ?? null,
        status: options.status ?? 'active',
        limit: options.limit,
      }
    );
  },

  async loadListing(context, id) {
    return proxyPost<MarketplaceListing>(
      '/api/marketplace/mercado-livre/item',
      {
        context,
        id,
      }
    );
  },

  async loadListingDescription(context, id) {
    return proxyPost<MarketplaceListingDescription>(
      '/api/marketplace/mercado-livre/description',
      {
        context,
        id,
      }
    );
  },
};

export default mercadoLivreAdapter;
