import 'server-only';

import { normalizeMercadoLivreListing } from '../../adapters/mercado-livre/normalizeMercadoLivreListing';
import type { ImportExecutionContext } from '../../types/integration.types';
import type {
  MarketplaceListing,
  MarketplaceListingDescription,
  MarketplaceListingsResult,
} from '../../types/marketplace.types';

const API_BASE_URL = 'https://api.mercadolibre.com';
const DETAILS_CHUNK_SIZE = 20;
const REQUEST_TIMEOUT_MS = 30_000;

interface MercadoLivreCredentials {
  userId: number;
  accessToken: string;
}

export class MercadoLivreApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null = null
  ) {
    super(message);
    this.name = 'MercadoLivreApiError';
  }
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null;

const asString = (value: unknown): string | null =>
  value === null || value === undefined || String(value).trim() === ''
    ? null
    : String(value).trim();

const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const unwrapResponseRecord = (value: unknown): UnknownRecord | null => {
  const unwrapped = Array.isArray(value) ? value[0] : value;
  const record = asRecord(unwrapped);
  return asRecord(record?.data) ?? record;
};

const safeFetchError = (error: unknown): string => {
  if (!(error instanceof Error)) return 'erro de rede desconhecido';

  const cause = asRecord(error.cause);
  const causeCode = asString(cause?.code);
  const causeMessage = asString(cause?.message);

  return [error.message, causeCode, causeMessage]
    .filter((value, index, values): value is string =>
      Boolean(value) && values.indexOf(value) === index
    )
    .join(' | ');
};

const credentialsFrom = (
  context: ImportExecutionContext
): MercadoLivreCredentials => {
  const userId = context?.marketplace?.userId;
  const accessToken = context?.marketplace?.accessToken?.trim();

  if (userId === null || userId === undefined || !Number.isFinite(Number(userId))) {
    throw new Error('Mercado Livre user_id ausente no contexto da integração.');
  }

  if (!accessToken) {
    throw new Error('Mercado Livre access_token ausente no contexto da integração.');
  }

  return {
    userId: Number(userId),
    accessToken,
  };
};

const mercadoLivreFetch = async (
  url: string,
  accessToken: string
): Promise<unknown> => {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'DriveParts-ImportEngine/1.0',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(
      `Falha ao conectar à API do Mercado Livre: ${safeFetchError(error)}.`
    );
  }

  if (!response.ok) {
    throw new MercadoLivreApiError(
      `API do Mercado Livre retornou HTTP ${response.status}.`,
      response.status
    );
  }

  try {
    return await response.json();
  } catch {
    throw new Error('API do Mercado Livre retornou JSON inválido.');
  }
};

const chunksOf = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
};

const loadListingBatch = async (
  ids: string[],
  accessToken: string
): Promise<MarketplaceListing[]> => {
  const listings: MarketplaceListing[] = [];

  for (const chunk of chunksOf(ids, DETAILS_CHUNK_SIZE)) {
    const params = new URLSearchParams({
      ids: chunk.join(','),
    });
    const response = await mercadoLivreFetch(
      `${API_BASE_URL}/items?${params.toString()}`,
      accessToken
    );

    if (!Array.isArray(response)) {
      throw new Error('Resposta de detalhes em lote do Mercado Livre inválida.');
    }

    for (const rawItem of response) {
      const wrapper = asRecord(rawItem);
      const responseCode = wrapper ? asNumber(wrapper.code) : null;
      if (responseCode !== null && responseCode !== 200) continue;

      listings.push(normalizeMercadoLivreListing(rawItem));
    }
  }

  return listings;
};

export const scanMercadoLivreListings = async (
  context: ImportExecutionContext,
  options: {
    scrollId?: string | null;
    status?: string;
    limit?: number;
  } = {}
): Promise<MarketplaceListingsResult> => {
  const credentials = credentialsFrom(context);
  const params = new URLSearchParams({
    search_type: 'scan',
    status: options.status?.trim() || 'active',
    scroll_id: options.scrollId?.trim() || '',
  });

  if (
    typeof options.limit === 'number' &&
    Number.isFinite(options.limit) &&
    options.limit > 0
  ) {
    params.set('limit', String(Math.floor(options.limit)));
  }

  const response = await mercadoLivreFetch(
    `${API_BASE_URL}/users/${credentials.userId}/items/search?${params.toString()}`,
    credentials.accessToken
  );
  const responseRecord = unwrapResponseRecord(response);
  const ids = Array.isArray(responseRecord?.results)
    ? responseRecord.results
        .map(asString)
        .filter((id): id is string => id !== null)
    : [];
  const listings = await loadListingBatch(ids, credentials.accessToken);

  return {
    ids,
    listings,
    scrollId: asString(responseRecord?.scroll_id),
    totalLoaded: listings.length,
  };
};

export const loadMercadoLivreListing = async (
  context: ImportExecutionContext,
  id: string
): Promise<MarketplaceListing> => {
  const credentials = credentialsFrom(context);
  const normalizedId = id?.trim();

  if (!normalizedId) {
    throw new Error('ID do anúncio Mercado Livre é obrigatório.');
  }

  const response = await mercadoLivreFetch(
    `${API_BASE_URL}/items/${encodeURIComponent(normalizedId)}`,
    credentials.accessToken
  );

  return normalizeMercadoLivreListing(response);
};

export const loadMercadoLivreListingDescription = async (
  context: ImportExecutionContext,
  id: string
): Promise<MarketplaceListingDescription> => {
  const credentials = credentialsFrom(context);
  const normalizedId = id?.trim();

  if (!normalizedId) {
    throw new Error('ID do anúncio Mercado Livre é obrigatório.');
  }

  const response = await mercadoLivreFetch(
    `${API_BASE_URL}/items/${encodeURIComponent(normalizedId)}/description`,
    credentials.accessToken
  );
  const record = unwrapResponseRecord(response);

  return {
    plainText: asString(record?.plain_text),
    raw: response,
  };
};
