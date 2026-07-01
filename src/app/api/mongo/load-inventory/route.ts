import { NextResponse } from 'next/server';
import { mongoInventoryAdapter } from '../../../../adapters/mongo/inventory/mongoInventoryAdapter';
import { isMongoConfigured } from '../../../../lib/mongoServer';

/**
 * POST /api/mongo/load-inventory  body: { storeId }
 * Lê o inventário de uma loja do Mongo (Drive Parts). READ-ONLY — usado pelo
 * dry-run/análise. Roda server-side (o driver mongodb não funciona no browser).
 */
export async function POST(request: Request) {
  if (!isMongoConfigured()) {
    return NextResponse.json({ error: 'MONGO_URI não configurada no servidor' }, { status: 503 });
  }

  let body: { storeId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const storeId = typeof body.storeId === 'string' ? body.storeId.trim() : '';
  if (!storeId) {
    return NextResponse.json({ error: 'storeId obrigatório' }, { status: 400 });
  }

  try {
    const items = await mongoInventoryAdapter.loadStoreInventory(storeId);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
