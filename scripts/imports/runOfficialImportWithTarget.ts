import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { MongoClient, type Document } from 'mongodb';
import { getRequiredMongoEnv } from '../../src/adapters/mongo/client/mongoEnv';
import { authenticateMercadoLivreIntegration } from '../../src/adapters/mercado-livre/mercadoLivreAuthAdapter';
import {
  createMongoInventoryPersistenceAdapter,
  executeOfficialImportWithTarget,
  type MarketplaceItemFetcher,
} from '../../src/engine/import-targets/officialImportWithTarget';
import { createMongoImportTarget } from '../../src/engine/import-targets/mongo/mongoImportTarget';
import {
  normalizeImportTargetName,
} from '../../src/engine/import-targets/selectImportTarget';
import type { ImportRunMode, ImportTargetName } from '../../src/engine/import-targets/types';
import type { ColumnMapping } from '../../src/modules/importer/suggestFieldMapping';

interface Options {
  file: string;
  integrationId: string;
  target: ImportTargetName;
  mode: ImportRunMode;
  allowCategoryPending: boolean;
}

const loadLocalEnv = (): void => {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
};

const parseArgs = (): Options => {
  const args = process.argv.slice(2);
  const valueOf = (name: string): string | null => {
    const prefix = `--${name}=`;
    const inline = args.find((arg) => arg.startsWith(prefix));
    if (inline) return inline.slice(prefix.length);
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] ?? null : null;
  };
  const file = valueOf('file');
  const integrationId = valueOf('integrationId');
  const target = valueOf('target');
  const write = args.includes('--write');
  const dryRun = args.includes('--dryRun') || args.includes('--dry-run');

  if (!file) throw new Error('Informe --file <caminho_da_planilha>.');
  if (!integrationId) throw new Error('Informe --integrationId <id>.');
  if (!target) throw new Error('Informe --target supabase ou --target mongo.');
  if (write && dryRun) throw new Error('Use apenas um modo: --dryRun ou --write.');

  return {
    file: file.replace(/^['"]|['"]$/g, ''),
    integrationId: integrationId.replace(/^['"]|['"]$/g, ''),
    target: normalizeImportTargetName(target),
    mode: write ? 'write' : 'dryRun',
    allowCategoryPending: args.includes('--allow-category-pending'),
  };
};

const createMlFetcher = (accessToken: string | null | undefined): MarketplaceItemFetcher | null => {
  if (!accessToken) return null;
  const cache = new Map<string, ReturnType<MarketplaceItemFetcher>>();

  return (mlbId: string) => {
    const cached = cache.get(mlbId);
    if (cached) return cached;

    const request = fetch(`https://api.mercadolibre.com/items/${encodeURIComponent(mlbId)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'DriveParts-OfficialImportTarget/1.0',
      },
      signal: AbortSignal.timeout(30000),
    }).then(async (response): Promise<Awaited<ReturnType<MarketplaceItemFetcher>>> => {
      if (response.status === 401 || response.status === 403) return { status: 'no_access' };
      if (response.status === 404) return { status: 'not_found' };
      if (!response.ok) return { status: 'error', error: `HTTP ${response.status}` };
      return { status: 'found', data: await response.json() as Document };
    }).catch((error) => ({
      status: 'error' as const,
      error: error instanceof Error ? error.message : String(error),
    }));

    cache.set(mlbId, request);
    return request;
  };
};

const defaultColumnMapping: ColumnMapping = {
  code: 'Código',
  title: 'Produto',
  price: 'Valor Venda (R$)',
  location: 'Localização',
  mlb_ids: 'Código MLB',
  image_urls: 'images',
  stock_quantity: 'Estoque',
};

const main = async () => {
  loadLocalEnv();
  const options = parseArgs();
  const fileBuffer = readFileSync(options.file);
  const executionContext = await authenticateMercadoLivreIntegration(options.integrationId);
  let mongoClient: MongoClient | null = null;

  try {
    const supabaseDeps = options.target === 'supabase'
      ? {
          inventoryAdapter: (await import('../../src/adapters/supabase/supabaseInventoryAdapter')).supabaseInventoryAdapter,
          storageLocationAdapter: (await import('../../src/adapters/supabase/supabaseStorageLocationAdapter')).supabaseStorageLocationAdapter,
          historyAdapter: (await import('../../src/adapters/supabase/supabaseImportHistoryAdapter')).supabaseImportHistoryAdapter,
          adRegistryAdapter: (await import('../../src/adapters/supabase/supabaseMarketplaceAdAdapter')).supabaseMarketplaceAdAdapter,
          marketplaceAdapter: (await import('../../src/adapters/mercado-livre/mercadoLivreAdapter')).mercadoLivreAdapter,
        }
      : undefined;

    let mongoDeps;
    if (options.target === 'mongo') {
      const { uri, dbName } = getRequiredMongoEnv();
      mongoClient = new MongoClient(uri, {
        connectTimeoutMS: 30000,
        serverSelectionTimeoutMS: 30000,
      });
      await mongoClient.connect();
      const db = mongoClient.db(dbName);
      mongoDeps = {
        db,
        target: createMongoImportTarget(db),
        inventoryAdapter: createMongoInventoryPersistenceAdapter(db),
        fetchMarketplaceItem: createMlFetcher(executionContext.marketplace?.accessToken),
      };
    }

    const result = await executeOfficialImportWithTarget({
      fileBuffer: fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength
      ) as ArrayBuffer,
      fileName: basename(options.file),
      executionContext,
      target: options.target,
      mode: options.mode,
      allowCategoryPending: options.allowCategoryPending,
      columnMapping: defaultColumnMapping,
      supabase: supabaseDeps,
      mongo: mongoDeps,
    });

    console.log(JSON.stringify({
      target: result.target,
      mode: result.mode,
      runId: result.runId,
      testRunId: result.testRunId,
      fileName: result.fileName,
      integrationId: result.integrationId,
      storeId: result.storeId,
      totalRows: result.totalRows,
      validRows: result.validRows,
      invalidRows: result.invalidRows,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      conflicts: result.conflicts,
      warnings: result.warnings,
      errors: result.errors,
      wroteDocuments: result.wroteDocuments,
      write: result.write,
    }, null, 2));
  } finally {
    await mongoClient?.close();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
