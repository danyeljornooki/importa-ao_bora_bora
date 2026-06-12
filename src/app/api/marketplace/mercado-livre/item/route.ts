import { NextResponse } from 'next/server';
import {
  loadMercadoLivreListing,
  MercadoLivreApiError,
} from '../../../../../server/marketplace/mercadoLivreService';
import type { ImportExecutionContext } from '../../../../../types/integration.types';

export const runtime = 'nodejs';

interface ItemRequestBody {
  context?: ImportExecutionContext;
  id?: string;
}

const hasMarketplaceCredentials = (
  context: ImportExecutionContext | undefined
): context is ImportExecutionContext => {
  const userId = context?.marketplace?.userId;
  const accessToken = context?.marketplace?.accessToken?.trim();

  return userId != null && Number.isFinite(Number(userId)) && Boolean(accessToken);
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Falha ao carregar anúncio.';

export async function POST(request: Request) {
  let body: ItemRequestBody;
  try {
    body = await request.json() as ItemRequestBody;
  } catch {
    return NextResponse.json(
      { error: 'Body JSON inválido.' },
      { status: 400 }
    );
  }

  if (!hasMarketplaceCredentials(body.context)) {
    return NextResponse.json(
      {
        error:
          'Contexto Mercado Livre sem user_id ou access_token para consultar o anúncio.',
      },
      { status: 400 }
    );
  }

  if (!body.id?.trim()) {
    return NextResponse.json(
      { error: 'ID do anúncio é obrigatório.' },
      { status: 400 }
    );
  }

  try {
    const listing = await loadMercadoLivreListing(body.context, body.id);
    return NextResponse.json(listing);
  } catch (error) {
    const externalStatus =
      error instanceof MercadoLivreApiError ? error.status : null;

    return NextResponse.json(
      { error: errorMessage(error), status: externalStatus },
      {
        status:
          externalStatus === 403 || externalStatus === 404
            ? externalStatus
            : 502,
      }
    );
  }
}
