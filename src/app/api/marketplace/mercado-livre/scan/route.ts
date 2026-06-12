import { NextResponse } from 'next/server';
import { scanMercadoLivreListings } from '../../../../../server/marketplace/mercadoLivreService';
import type { ImportExecutionContext } from '../../../../../types/integration.types';

export const runtime = 'nodejs';

interface ScanRequestBody {
  context?: ImportExecutionContext;
  scrollId?: string | null;
  status?: string;
  limit?: number;
}

const hasMarketplaceCredentials = (
  context: ImportExecutionContext | undefined
): context is ImportExecutionContext => {
  const userId = context?.marketplace?.userId;
  const accessToken = context?.marketplace?.accessToken?.trim();

  return userId != null && Number.isFinite(Number(userId)) && Boolean(accessToken);
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Falha ao carregar anúncios.';

export async function POST(request: Request) {
  let body: ScanRequestBody;
  try {
    body = await request.json() as ScanRequestBody;
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
          'Contexto Mercado Livre sem user_id ou access_token para consultar anúncios.',
      },
      { status: 400 }
    );
  }

  try {
    const result = await scanMercadoLivreListings(body.context, {
      scrollId: body.scrollId,
      status: body.status,
      limit: body.limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error) },
      { status: 502 }
    );
  }
}
