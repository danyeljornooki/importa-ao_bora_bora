export interface MercadoLivreAuthResponse {
  access_token?: string | null;
  integracao?: MercadoLivreIntegrationResponse | null;
}

export interface MercadoLivreIntegrationResponse {
  _id?: string;
  loja_id: string;
  nome?: string | null;
  canal: 'mercado_livre_brasil' | string;
  status?: string | null;
  mercado_livre_brasil?: {
    user_id?: number | null;
    access_token?: string | null;
    refresh_token?: string | null;
    token_expires_in?: string | null;
    user?: Record<string, unknown> | null;
  };
}

export interface ImportExecutionContext {
  integrationId: string;
  storeId: string;
  channel: string;
  integrationName?: string | null;
  marketplace?: {
    type: 'mercado_livre_brasil';
    userId?: number | null;
    accessToken?: string | null;
    tokenExpiresIn?: string | null;
    user?: Record<string, unknown> | null;
  };
}
