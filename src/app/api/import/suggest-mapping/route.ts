import { NextResponse } from 'next/server';
import { suggestMappingWithAi } from '../../../../adapters/ai/openAiMappingAdapter';

/**
 * POST /api/import/suggest-mapping
 * body: { headers: string[], sample?: Record<string, unknown>[] }
 * Retorna { mapping } sugerido pela IA. A chave OPENAI_API_KEY fica no servidor.
 */
export async function POST(request: Request) {
  let body: { headers?: unknown; sample?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const headers = Array.isArray(body.headers)
    ? body.headers.filter((h): h is string => typeof h === 'string')
    : [];
  if (headers.length === 0) {
    return NextResponse.json({ error: 'headers obrigatório' }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY não configurada no servidor' },
      { status: 503 }
    );
  }

  const sample = Array.isArray(body.sample)
    ? (body.sample as Record<string, unknown>[])
    : [];

  try {
    const result = await suggestMappingWithAi(headers, sample, apiKey);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
