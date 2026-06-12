import type {
  ImportExecutionContext,
  MercadoLivreAuthResponse,
  MercadoLivreIntegrationResponse,
} from '../../types/integration.types';

const AUTHENTICATION_URL =
  'https://n8n.driveparts.virtuaserver.com.br/webhook/mercado-livre-brasil/authentication';

export type MercadoLivreRequestFormat =
  | 'json'
  | 'form-urlencoded';

export interface MercadoLivreAuthenticationAttempt {
  format: MercadoLivreRequestFormat;
  status: number | null;
  body: string;
  headers: Record<string, string>;
}

export class MercadoLivreAuthenticationError extends Error {
  readonly attempts: MercadoLivreAuthenticationAttempt[];

  constructor(attempts: MercadoLivreAuthenticationAttempt[]) {
    super(
      'Não foi possível autenticar integração Mercado Livre. Testados formatos: json, form-urlencoded.'
    );
    this.name = 'MercadoLivreAuthenticationError';
    this.attempts = attempts.map((attempt) => ({
      ...attempt,
      headers: { ...attempt.headers },
    }));
  }
}

interface AuthenticationRequest {
  format: MercadoLivreRequestFormat;
  headers: HeadersInit;
  body: string;
}

const requiredString = (value: unknown, field: string): string => {
  if (value === null || value === undefined || String(value).trim() === '') {
    throw new Error(`Resposta de autenticação inválida: ${field} ausente.`);
  }

  return String(value).trim();
};

const optionalString = (value: unknown): string | null => {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null;
  }

  return String(value).trim();
};

const optionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const optionalRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : null;

const isTokenKey = (key: string): boolean =>
  key.toLowerCase().includes('token');

const sanitizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        isTokenKey(key) ? '[hidden]' : sanitizeValue(item),
      ])
    );
  }

  return value;
};

const sanitizeText = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '(empty body)';

  try {
    return JSON.stringify(sanitizeValue(JSON.parse(trimmed)), null, 2);
  } catch {
    return trimmed
      .replace(
        /(["']?(?:access_token|refresh_token|token)["']?\s*[:=]\s*["']?)([^"',&\s}]+)/gi,
        '$1[hidden]'
      )
      .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [hidden]')
      .slice(0, 4000);
  }
};

const safeResponseHeaders = (headers: Headers): Record<string, string> => {
  const safeNames = [
    'content-type',
    'content-length',
    'date',
    'server',
    'x-request-id',
    'x-correlation-id',
  ];

  return Object.fromEntries(
    safeNames
      .map((name) => [name, headers.get(name)] as const)
      .filter((entry): entry is readonly [string, string] => entry[1] !== null)
  );
};

const responseRecord = (value: unknown): MercadoLivreAuthResponse => {
  const firstValue = Array.isArray(value) ? value[0] : value;
  const dataValue =
    firstValue && typeof firstValue === 'object' && 'data' in firstValue
      ? (firstValue as Record<string, unknown>).data
      : firstValue;
  const candidate = Array.isArray(dataValue) ? dataValue[0] : dataValue;

  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Resposta de autenticação inválida: objeto esperado.');
  }

  return candidate as MercadoLivreAuthResponse;
};

const buildRequests = (integrationId: string): AuthenticationRequest[] => [
  {
    format: 'json',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      integration_id: integrationId,
    }),
  },
  {
    format: 'form-urlencoded',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      integration_id: integrationId,
    }).toString(),
  },
];

const mapContext = (
  integrationId: string,
  rawResponse: unknown
): ImportExecutionContext => {
  const authResponse = responseRecord(rawResponse);
  const integration = (
    authResponse.integracao ?? authResponse
  ) as MercadoLivreIntegrationResponse;
  const storeId = requiredString(integration.loja_id, 'loja_id');
  const channel = requiredString(integration.canal, 'canal');
  const mercadoLivre = integration.mercado_livre_brasil;

  return {
    integrationId: optionalString(integration._id) ?? integrationId,
    storeId,
    channel,
    integrationName: optionalString(integration.nome),
    marketplace: channel === 'mercado_livre_brasil'
      ? {
          type: 'mercado_livre_brasil',
          userId: optionalNumber(mercadoLivre?.user_id),
          accessToken: optionalString(
            mercadoLivre?.access_token ?? authResponse.access_token
          ),
          tokenExpiresIn: optionalString(mercadoLivre?.token_expires_in),
          user: optionalRecord(mercadoLivre?.user),
        }
      : undefined,
  };
};

const parseResponseBody = (body: string): unknown => {
  if (!body.trim()) {
    throw new Error('Resposta vazia.');
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new Error('Resposta JSON inválida.');
  }
};

export const authenticateMercadoLivreIntegration = async (
  integrationId: string
): Promise<ImportExecutionContext> => {
  const normalizedIntegrationId = integrationId?.trim();
  if (!normalizedIntegrationId) {
    throw new Error('Integration ID é obrigatório.');
  }

  const attempts: MercadoLivreAuthenticationAttempt[] = [];

  for (const request of buildRequests(normalizedIntegrationId)) {
    console.info(
      `[MercadoLivreAuth] Tentando formato: ${request.format}`
    );

    try {
      const response = await fetch(AUTHENTICATION_URL, {
        method: 'POST',
        headers: request.headers,
        body: request.body,
      });

      console.info(
        `[MercadoLivreAuth] Formato ${request.format}: HTTP ${response.status}`
      );

      const responseText = await response.text();
      const attempt: MercadoLivreAuthenticationAttempt = {
        format: request.format,
        status: response.status,
        body: sanitizeText(responseText),
        headers: safeResponseHeaders(response.headers),
      };

      if (!response.ok) {
        attempts.push(attempt);
        console.warn('[MercadoLivreAuth] Tentativa falhou', attempt);
        continue;
      }

      try {
        const rawResponse = parseResponseBody(responseText);
        return mapContext(normalizedIntegrationId, rawResponse);
      } catch (error) {
        attempts.push(attempt);
        console.warn('[MercadoLivreAuth] Tentativa falhou', {
          ...attempt,
          validationError:
            error instanceof Error ? error.message : 'Resposta inválida',
        });
      }
    } catch (error) {
      const attempt: MercadoLivreAuthenticationAttempt = {
        format: request.format,
        status: null,
        body: sanitizeText(
          error instanceof Error ? error.message : 'Falha de conexão'
        ),
        headers: {},
      };
      attempts.push(attempt);
      console.warn('[MercadoLivreAuth] Tentativa falhou', attempt);
    }
  }

  throw new MercadoLivreAuthenticationError(attempts);
};

export default authenticateMercadoLivreIntegration;
