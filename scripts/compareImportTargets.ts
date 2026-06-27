import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { MongoClient, type Db, type Document } from 'mongodb';
import { runImport } from '../src/engine/runImport';
import { getRequiredMongoEnv } from '../src/adapters/mongo/mongoEnv';
import { MONGO_COLLECTIONS } from '../src/adapters/mongo/collectionNames';
import { normalizeImportPlanForComparison } from '../src/engine/import-targets/compare/normalizeImportPlanForComparison';
import { compareImportTargetPlans, getComparisonExitCode } from '../src/engine/import-targets/compare/compareImportTargetPlans';
import { resolveEnrichmentForComparison, type EnrichmentAdFetchResult } from '../src/engine/import-targets/compare/resolveEnrichmentForComparison';
import { compareEnrichmentSnapshots } from '../src/engine/import-targets/compare/compareEnrichmentSnapshots';
import { createMongoImportTarget } from '../src/engine/import-targets/mongoImportTarget';
import type { ImportWriteTarget } from '../src/engine/import-targets/types';
import type { ExistingInventoryItem, InventoryPersistenceAdapter, PersistenceActionResult } from '../src/types/inventory.types';
import type { StorageLocation } from '../src/core/locations/location.types';
import type { StorageLocationAdapter } from '../src/core/locations/storageLocationAdapter';
import type { ColumnMapping } from '../src/modules/importer/suggestFieldMapping';

const AUTHENTICATION_URL =
  'https://n8n.driveparts.virtuaserver.com.br/webhook/mercado-livre-brasil/authentication';

interface Options {
  file: string;
  integrationId: string;
  json: boolean;
  includeEnrichment: boolean;
  skipMlFetch: boolean;
  output?: string;
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
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
};

const unquote = (value: string): string => value.trim().replace(/^['"]|['"]$/g, '');

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
  if (!file) throw new Error('Informe --file=<caminho_da_planilha>.');
  if (!integrationId) throw new Error('Informe --integrationId=<id>.');

  const output = valueOf('output');
  return {
    file: unquote(file),
    integrationId: unquote(integrationId),
    json: args.includes('--json'),
    includeEnrichment: args.includes('--include-enrichment'),
    skipMlFetch: args.includes('--skip-ml-fetch'),
    output: output ? unquote(output) : undefined,
  };
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const asString = (value: unknown): string | null =>
  value === null || value === undefined || String(value).trim() === ''
    ? null
    : String(value).trim();

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
};

const authenticateStore = async (
  integrationId: string
): Promise<{ storeId: string; accessToken: string | null }> => {
  const attempts = [
    {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ integration_id: integrationId }),
    },
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ integration_id: integrationId }).toString(),
    },
  ];

  for (const attempt of attempts) {
    const response = await fetch(AUTHENTICATION_URL, {
      method: 'POST',
      headers: attempt.headers,
      body: attempt.body,
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) continue;

    const body = await response.json();
    const root = Array.isArray(body) ? body[0] : body;
    const data = asRecord(root)?.data ?? root;
    const auth = asRecord(Array.isArray(data) ? data[0] : data);
    const integration = asRecord(auth?.integracao) ?? auth;
    const mercadoLivre = asRecord(integration?.mercado_livre_brasil);
    const storeId = asString(integration?.loja_id);
    if (storeId) {
      return {
        storeId,
        accessToken: asString(mercadoLivre?.access_token ?? auth?.access_token),
      };
    }
  }

  throw new Error('Nao foi possivel resolver store_id da integration_id.');
};

const mapInventoryDoc = (doc: Document): ExistingInventoryItem => ({
  id: String(doc.id ?? doc._id),
  store_id: String(doc.store_id ?? ''),
  id_int: toNumberOrNull(doc.id_int),
  id_string: asString(doc.id_string ?? doc.primary_anuncio_mlb_id),
  primary_anuncio_mlb_id: asString(doc.primary_anuncio_mlb_id),
  code: asString(doc.code),
  tag_code: asString(doc.tag_code),
  marketplace_name: asString(doc.marketplace_name),
  description: asString(doc.description),
  location: asString(doc.storage_location_name),
  storage_location_id: asString(doc.storage_location_id),
  storage_location_name: asString(doc.storage_location_name),
  stock_quantity: toNumberOrNull(doc.stock_quantity),
  price: toNumberOrNull(doc.price),
  status: asString(doc.status),
  deleted: typeof doc.deleted === 'boolean' ? doc.deleted : null,
  raw: doc,
});

const createReadOnlyMongoInventoryAdapter = (db: Db): InventoryPersistenceAdapter => ({
  async loadStoreInventory(storeId: string): Promise<ExistingInventoryItem[]> {
    const docs = await db.collection(MONGO_COLLECTIONS.inventoryItems)
      .find(
        { store_id: storeId, deleted: { $ne: true } },
        {
          projection: {
            id: 1,
            store_id: 1,
            id_int: 1,
            id_string: 1,
            primary_anuncio_mlb_id: 1,
            code: 1,
            tag_code: 1,
            marketplace_name: 1,
            description: 1,
            storage_location_id: 1,
            storage_location_name: 1,
            stock_quantity: 1,
            price: 1,
            status: 1,
            deleted: 1,
          },
        }
      )
      .limit(50000)
      .toArray();
    return docs.map(mapInventoryDoc);
  },
  async createItem(): Promise<PersistenceActionResult> {
    return { success: false, error: 'read-only comparison target' };
  },
  async updateItem(): Promise<PersistenceActionResult> {
    return { success: false, error: 'read-only comparison target' };
  },
});

const mapStorageDoc = (doc: Document): StorageLocation => ({
  id: String(doc.id ?? doc._id),
  _id: String(doc.id ?? doc._id),
  store_id: String(doc.store_id ?? ''),
  name: String(doc.name ?? ''),
  abbreviation: asString(doc.abbreviation),
  storage_location_type_id: asString(doc.storage_location_type_id),
  storage_location_type_name: asString(doc.storage_location_type_name),
  icon_key: asString(doc.icon_key),
  color_key: asString(doc.color_key),
  path_text: asString(doc.path_text),
  location_path_text: asString(doc.location_path_text),
  location_path_key: asString(doc.location_path_key),
  location_path_names: Array.isArray(doc.location_path_names) ? doc.location_path_names.map(String) : undefined,
  location_path_slugs: Array.isArray(doc.location_path_slugs) ? doc.location_path_slugs.map(String) : undefined,
  path_ids: Array.isArray(doc.path_ids) ? doc.path_ids.map(String) : undefined,
  path_items: Array.isArray(doc.path_items) ? doc.path_items as StorageLocation['path_items'] : undefined,
  status: asString(doc.status) ?? undefined,
});

const createReadOnlyMongoStorageAdapter = (db: Db): StorageLocationAdapter => ({
  async findCandidates(storeId: string): Promise<StorageLocation[]> {
    const docs = await db.collection(MONGO_COLLECTIONS.storageLocations)
      .find({ store_id: storeId, status: { $ne: 'deleted' } })
      .limit(50000)
      .toArray();
    return docs.map(mapStorageDoc);
  },
  async createLocation(): Promise<StorageLocation> {
    throw new Error('read-only comparison target');
  },
});

const createSupabaseCategoryTarget = (
  client: any
): Pick<ImportWriteTarget, 'findPartCategory'> => ({
  async findPartCategory(input) {
    for (const table of ['parte', 'part_categories']) {
      try {
        const { data, error } = await client
          .from(table)
          .select('*')
          .eq('MLB_categoria_id', input.categoryId)
          .maybeSingle();
        if (!error && data) {
          return { id: String(data.id ?? data._id ?? input.categoryId), raw: data };
        }
      } catch {
        // Read-only fallback: tabela pode nao existir nesse ambiente.
      }
    }
    return null;
  },
});

const createAdFetcher = (
  accessToken: string | null
): ((mlbId: string) => Promise<EnrichmentAdFetchResult>) => {
  const cache = new Map<string, Promise<EnrichmentAdFetchResult>>();
  return (mlbId: string) => {
    const cached = cache.get(mlbId);
    if (cached) return cached;

    const request = (async (): Promise<EnrichmentAdFetchResult> => {
      if (!accessToken) return { status: 'no_access' };
      try {
        const response = await fetch(`https://api.mercadolibre.com/items/${encodeURIComponent(mlbId)}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': 'DriveParts-ImportTargetComparison/1.0',
          },
          signal: AbortSignal.timeout(30000),
        });
        if (response.status === 401 || response.status === 403) return { status: 'no_access' };
        if (response.status === 404) return { status: 'not_found' };
        if (!response.ok) return { status: 'fetch_error', error: `HTTP ${response.status}` };
        return { status: 'found', data: await response.json() as Document };
      } catch (error) {
        return { status: 'fetch_error', error: error instanceof Error ? error.message : String(error) };
      }
    })();

    cache.set(mlbId, request);
    return request;
  };
};

const renderTextReport = (report: ReturnType<typeof compareImportTargetPlans>): string => {
  const lines = [
    'IMPORT TARGET COMPARISON',
    `Arquivo: ${report.file}`,
    `Integration: ${report.integrationId}`,
    `Store: ${report.storeId}`,
    `Linhas: ${report.summary.totalRows}`,
    `Equal: ${report.summary.equal}`,
    `Critical: ${report.summary.critical}`,
    `Warning: ${report.summary.warning}`,
    `Expected: ${report.summary.expected}`,
    `Info: ${report.summary.info}`,
  ];

  if (report.summary.enrichment) {
    lines.push(
      '',
      'ENRICHMENT',
      `Equal: ${report.summary.enrichment.equal}`,
      `Critical: ${report.summary.enrichment.critical}`,
      `Warning: ${report.summary.enrichment.warning}`,
      `Expected: ${report.summary.enrichment.expected}`,
      `Category pending: ${report.summary.enrichment.categoryPending}`,
      `Ad found: ${report.summary.enrichment.adFound}`,
      `Ad no access: ${report.summary.enrichment.adNoAccess}`,
      `Ad not found: ${report.summary.enrichment.adNotFound}`,
      `Image diffs: ${report.summary.enrichment.imageDiffs}`
    );
  }

  lines.push('');

  for (const row of report.rows.filter((item: any) => item.status !== 'equal' || (item.enrichmentStatus && item.enrichmentStatus !== 'equal')).slice(0, 60)) {
    lines.push(`Linha ${row.row} - ${row.code ?? row.id_int ?? row.id_string ?? '-'}`);
    lines.push(`Supabase: ${row.supabaseAction}`);
    lines.push(`Mongo: ${row.mongoAction}`);
    if ('enrichmentStatus' in row) {
      lines.push(`Enrichment: ${(row as any).enrichmentStatus}`);
    }
    for (const diff of row.diffs.slice(0, 8)) {
      lines.push(`- ${diff.severity} ${diff.field}: ${diff.reason}`);
    }
    for (const diff of ((row as any).enrichmentDiffs ?? []).slice(0, 8)) {
      lines.push(`- enrichment ${diff.severity} ${diff.field}: ${diff.reason}`);
    }
    lines.push('');
  }

  return lines.join('\n');
};

const toArrayBuffer = (buffer: Buffer): ArrayBuffer =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

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
  const { supabaseInventoryAdapter } = await import('../src/adapters/supabase/supabaseInventoryAdapter');
  const { supabaseStorageLocationAdapter } = await import('../src/adapters/supabase/supabaseStorageLocationAdapter');
  const { uri, dbName } = getRequiredMongoEnv();
  const fileBuffer = toArrayBuffer(readFileSync(options.file));
  const context = await authenticateStore(options.integrationId);
  const storeId = context.storeId;
  const client = new MongoClient(uri, {
    connectTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
  });

  try {
    await client.connect();
    const db = client.db(dbName);
    const mongoInventoryAdapter = createReadOnlyMongoInventoryAdapter(db);
    const mongoStorageAdapter = createReadOnlyMongoStorageAdapter(db);
    const mongoTarget = createMongoImportTarget(db);
    const { supabase } = await import('../src/lib/supabaseClient');
    const supabaseCategoryTarget = createSupabaseCategoryTarget(supabase);

    const [supabaseResult, mongoResult] = await Promise.all([
      runImport(fileBuffer, {
        storeId,
        integrationId: options.integrationId,
        fileName: basename(options.file),
        adapter: supabaseInventoryAdapter,
        storageLocationAdapter: supabaseStorageLocationAdapter,
        columnMapping: defaultColumnMapping,
      }),
      runImport(fileBuffer, {
        storeId,
        integrationId: options.integrationId,
        fileName: basename(options.file),
        adapter: mongoInventoryAdapter,
        storageLocationAdapter: mongoStorageAdapter,
        columnMapping: defaultColumnMapping,
      }),
    ]);

    const supabasePlan = normalizeImportPlanForComparison('supabase', supabaseResult);
    const mongoPlan = normalizeImportPlanForComparison('mongo', mongoResult);
    const report = compareImportTargetPlans({
      file: basename(options.file),
      integrationId: options.integrationId,
      storeId,
      supabase: supabasePlan,
      mongo: mongoPlan,
    });

    if (options.includeEnrichment) {
      const fetchAd = createAdFetcher(context.accessToken);
      const [supabaseSnapshots, mongoSnapshots] = await Promise.all([
        Promise.all(supabasePlan.rows.map((row) => resolveEnrichmentForComparison({
          row,
          integrationId: options.integrationId,
          storeId,
          targetName: 'supabase',
          target: supabaseCategoryTarget,
          allowExternalReads: !options.skipMlFetch,
          fetchAd,
        }))),
        Promise.all(mongoPlan.rows.map((row) => resolveEnrichmentForComparison({
          row,
          integrationId: options.integrationId,
          storeId,
          targetName: 'mongo',
          target: mongoTarget,
          allowExternalReads: !options.skipMlFetch,
          fetchAd,
        }))),
      ]);
      const enrichment = compareEnrichmentSnapshots(supabaseSnapshots, mongoSnapshots);
      report.summary.enrichment = enrichment.summary;
      report.rows = report.rows.map((row) => {
        const enrichmentRow = enrichment.rows.find((item) => item.row === row.row);
        return {
          ...row,
          planStatus: row.status,
          enrichmentStatus: enrichmentRow?.status ?? 'equal',
          enrichmentDiffs: enrichmentRow?.diffs ?? [],
        } as any;
      });
    }

    if (options.output) {
      mkdirSync(dirname(options.output), { recursive: true });
      writeFileSync(options.output, JSON.stringify(report, null, 2), 'utf8');
    }

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(renderTextReport(report));
      if (options.output) {
        console.log(`Relatorio JSON salvo em: ${options.output}`);
      }
    }

    process.exitCode = getComparisonExitCode(report);
  } finally {
    await client.close();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
