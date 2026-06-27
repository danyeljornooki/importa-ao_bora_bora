import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { MongoClient, type Document } from 'mongodb';
import { getRequiredMongoEnv } from '../src/adapters/mongo/mongoEnv';
import { parseImportFile } from '../src/modules/importer/parseImportFile';
import { normalizePart } from '../src/modules/importer/normalizePart';
import { validatePart } from '../src/modules/importer/validators/validatePart';
import { evaluateMongoImportQualityGate } from '../src/adapters/mongo/mongoImportQualityGate';
import {
  buildMongoImportMetadata,
  createMongoImportTarget,
} from '../src/engine/import-targets/mongoImportTarget';
import type { ImportRunMode, ImportWriteTarget } from '../src/engine/import-targets/types';
import type { PartCanonical } from '../src/modules/importer/schemas/part.schema';

const AUTHENTICATION_URL =
  'https://n8n.driveparts.virtuaserver.com.br/webhook/mercado-livre-brasil/authentication';

interface Options {
  file: string;
  integrationId: string;
  mode: ImportRunMode;
  allowCategoryPending: boolean;
}

interface MlContext {
  storeId: string;
  accessToken: string | null;
}

interface RowPlan {
  row: number;
  part: PartCanonical;
  valid: boolean;
  errors: string[];
  warnings: string[];
  action: 'create' | 'update' | 'skipped' | 'conflict';
  matchedId: string | null;
  categoryId: string | null;
  category: Document | null;
  categoryFound: boolean;
  locationFound: boolean;
  locationWouldCreate: boolean;
  locationId: string | null;
  locationName: string | null;
  mlbIds: string[];
  mlbFound: number;
  mlbNoAccess: number;
  mlbNotFound: number;
  adSnapshots: Document[];
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
  const write = args.includes('--write');
  const dryRun = args.includes('--dryRun') || args.includes('--dry-run');

  if (!file) throw new Error('Informe --file=<caminho_da_planilha>.');
  if (!integrationId) throw new Error('Informe --integrationId=<id>.');
  if (write && dryRun) throw new Error('Use apenas um modo: --dryRun ou --write.');

  return {
    file: unquote(file),
    integrationId: unquote(integrationId),
    mode: write ? 'write' : 'dryRun',
    allowCategoryPending: args.includes('--allow-category-pending'),
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

const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeHeader = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const findValue = (row: Record<string, unknown>, names: string[]): unknown => {
  const keys = Object.keys(row);
  for (const expected of names.map(normalizeHeader)) {
    const key = keys.find((candidate) => normalizeHeader(candidate) === expected);
    if (key) return row[key];
  }
  return undefined;
};

const adaptRow = (row: Record<string, unknown>): Record<string, unknown> => ({
  ...row,
  code: findValue(row, ['codigo', 'código']) ?? row.code,
  title: findValue(row, ['produto']) ?? row.title,
  price: findValue(row, ['valor venda (r$)', 'valor venda', 'valor']) ?? row.price,
  location: findValue(row, ['localizacao', 'localização']) ?? row.location,
  mlb_ids: findValue(row, ['codigo mlb', 'código mlb']) ?? row.mlb_ids,
  images: findValue(row, ['images', 'imagens']) ?? row.images,
  stock_quantity: findValue(row, ['estoque']) ?? row.stock_quantity,
});

const normalizeName = (value: unknown): string | null => {
  const text = asString(value);
  if (!text) return null;
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
};

const authenticate = async (integrationId: string): Promise<MlContext> => {
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

    if (!storeId) {
      throw new Error('Autenticacao retornou sem loja_id.');
    }

    return {
      storeId,
      accessToken: asString(mercadoLivre?.access_token ?? auth?.access_token),
    };
  }

  throw new Error('Nao foi possivel autenticar integration_id em modo read-only.');
};

const loadMlItem = async (
  mlbId: string,
  accessToken: string | null
): Promise<{ status: 'found' | 'no_access' | 'not_found'; data?: Document }> => {
  if (!accessToken) return { status: 'no_access' };

  const response = await fetch(`https://api.mercadolibre.com/items/${encodeURIComponent(mlbId)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'DriveParts-MongoImportAdapter/1.0',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (response.status === 403 || response.status === 401) return { status: 'no_access' };
  if (response.status === 404) return { status: 'not_found' };
  if (!response.ok) return { status: 'no_access' };
  return { status: 'found', data: await response.json() as Document };
};

const buildInventoryPayload = (input: {
  part: PartCanonical;
  storeId: string;
  locationId: string | null;
  locationName: string | null;
  category: Document | null;
  categoryId: string | null;
  metadata: Record<string, unknown>;
}): Document => {
  const category = input.category ?? {};
  const mlbId = input.part.mlb_ids?.[0] ?? null;
  const images = input.part.image_urls ?? [];

  return {
    store_id: input.storeId,
    id_int: input.part.id_int ?? null,
    id_string: input.part.id_string ?? null,
    code: input.part.code ?? null,
    marketplace_name: input.part.title ?? null,
    marketplace_name_normalized: normalizeName(input.part.title),
    stock_quantity: input.part.stock_quantity ?? 0,
    price: input.part.price,
    marketplace_price: input.part.price,
    use_default_price: false,
    deleted: false,
    status: (input.part.stock_quantity ?? 0) > 0 ? 'DISPONIVEL' : 'SEM_ESTOQUE',
    storage_location_id: input.locationId,
    storage_location_name: input.locationName ?? input.part.location ?? null,
    storage_location_source: input.locationId ? 'linked' : input.part.location ? 'pending' : null,
    part_category_id: category._id ? String(category._id) : null,
    part_category_name: asString(category.nome),
    mercado_libre_brasil_category_id: input.categoryId,
    catalog_attributes: category.catalogo_attributes ?? [],
    package_height: category.embalagemAltura ?? category.altura ?? null,
    package_width: category.embalagemLargura ?? category.largura ?? null,
    package_length: category.embalagemComprimento ?? category.comprimento ?? null,
    package_weight: category.embalagemPeso ?? category.peso ?? null,
    shopee_category_id: category.shopee_category_id ?? null,
    shopee_brand_id: category.shopee_brand_id ?? null,
    vehicle_type: category.vehicle_type ?? null,
    compatibilities_restrictions: category.compatibilities_restrictions ?? null,
    primary_anuncio_mlb_id: mlbId,
    image_ids: [],
    images,
    image_count: images.length,
    metadata: input.metadata,
  };
};

const buildPlan = async (
  target: ImportWriteTarget,
  context: MlContext,
  options: Options
): Promise<RowPlan[]> => {
  const buffer = readFileSync(options.file);
  const parsed = await parseImportFile(buffer, { fileName: basename(options.file) });
  const plans: RowPlan[] = [];

  for (const [index, row] of parsed.rows.entries()) {
    const warnings: string[] = [];
    let part: PartCanonical;

    try {
      part = normalizePart(adaptRow(row), parsed.sheetName);
    } catch (error) {
      plans.push({
        row: index + 1,
        part: { price: 0, stock_quantity: null, sourceRow: row },
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings,
        action: 'skipped',
        matchedId: null,
        categoryId: null,
        category: null,
        categoryFound: false,
        locationFound: false,
        locationWouldCreate: false,
        locationId: null,
        locationName: null,
        mlbIds: [],
        mlbFound: 0,
        mlbNoAccess: 0,
        mlbNotFound: 0,
        adSnapshots: [],
      });
      continue;
    }

    const validation = validatePart(part);
    warnings.push(...validation.warnings);
    const match = validation.valid
      ? await target.findInventoryItem({
          storeId: context.storeId,
          idInt: part.id_int,
          idString: part.id_string,
          code: part.code,
          tagCode: part.tag_code,
          identifierSearchKeys: [
            part.code,
            part.id_string,
            ...(part.mlb_ids ?? []),
          ].filter((value): value is string => typeof value === 'string' && value.trim() !== ''),
          mlbIds: part.mlb_ids,
        })
      : null;

    const location = part.location
      ? await target.findStorageLocation({ storeId: context.storeId, name: part.location })
      : null;

    let categoryId: string | null = null;
    let category: Document | null = null;
    let mlbFound = 0;
    let mlbNoAccess = 0;
    let mlbNotFound = 0;
    const adSnapshots: Document[] = [];

    for (const mlbId of part.mlb_ids ?? []) {
      const ml = await loadMlItem(mlbId, context.accessToken);
      if (ml.status === 'found' && ml.data) {
        mlbFound += 1;
        adSnapshots.push(ml.data);
        categoryId ??= asString(ml.data.category_id);
      } else if (ml.status === 'not_found') {
        mlbNotFound += 1;
        warnings.push(`ad_not_found:${mlbId}`);
      } else {
        mlbNoAccess += 1;
        warnings.push(`ad_no_access:${mlbId}`);
      }
    }

    if (categoryId) {
      const found = await target.findPartCategory({ categoryId });
      category = found?.raw ?? null;
      if (!category) warnings.push(`category_pending:${categoryId}`);
    } else if ((part.mlb_ids ?? []).length > 0) {
      warnings.push('category_pending');
    }

    plans.push({
      row: index + 1,
      part,
      valid: validation.valid,
      errors: validation.errors,
      warnings,
      action: !validation.valid ? 'skipped' : match ? 'update' : 'create',
      matchedId: match?.id ?? null,
      categoryId,
      category,
      categoryFound: Boolean(category),
      locationFound: Boolean(location),
      locationWouldCreate: Boolean(part.location && !location),
      locationId: location?.id ?? null,
      locationName: location?.name ?? part.location ?? null,
      mlbIds: part.mlb_ids ?? [],
      mlbFound,
      mlbNoAccess,
      mlbNotFound,
      adSnapshots,
    });
  }

  return plans;
};

const summarize = (plans: RowPlan[]) => ({
  totalRows: plans.length,
  valid: plans.filter((plan) => plan.valid).length,
  invalid: plans.filter((plan) => !plan.valid).length,
  creates: plans.filter((plan) => plan.action === 'create').length,
  updates: plans.filter((plan) => plan.action === 'update').length,
  skipped: plans.filter((plan) => plan.action === 'skipped').length,
  conflicts: plans.filter((plan) => plan.action === 'conflict').length,
  warnings: plans.reduce((total, plan) => total + plan.warnings.length, 0),
  categoriesFound: plans.filter((plan) => plan.categoryFound).length,
  categoriesMissing: plans.filter((plan) => plan.categoryId && !plan.categoryFound).length,
  locationsFound: plans.filter((plan) => plan.locationFound).length,
  locationsWouldCreate: plans.filter((plan) => plan.locationWouldCreate).length,
  mlbFound: plans.reduce((total, plan) => total + plan.mlbFound, 0),
  mlbNoAccess: plans.reduce((total, plan) => total + plan.mlbNoAccess, 0),
  mlbNotFound: plans.reduce((total, plan) => total + plan.mlbNotFound, 0),
});

const writePlan = async (
  target: ImportWriteTarget,
  context: MlContext,
  options: Options,
  testRunId: string,
  plans: RowPlan[]
) => {
  const dryRun = summarize(plans);
  const importedAt = new Date();
  const fileName = basename(options.file);
  const baseMetadata = buildMongoImportMetadata({
    testRunId,
    integrationId: options.integrationId,
    fileName,
    importedAt,
  }) as ReturnType<typeof buildMongoImportMetadata> & { testCreated: boolean };
  baseMetadata.testCreated = true;
  const run = await target.createImportRun({
    testRunId,
    storeId: context.storeId,
    integrationId: options.integrationId,
    fileName,
    target: 'mongo',
    status: 'completed',
    mode: 'write',
    totalRows: dryRun.totalRows,
    validRows: dryRun.valid,
    invalidRows: dryRun.invalid,
    createdCount: dryRun.creates,
    updatedCount: dryRun.updates,
    skippedCount: dryRun.skipped,
    conflictCount: dryRun.conflicts,
    warningCount: dryRun.warnings,
    metadata: baseMetadata,
  });
  const metadata = { ...baseMetadata, runId: run.id };

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let conflicts = 0;
  let adCreatedOrUpdated = 0;
  let locationsCreated = 0;

  for (const plan of plans) {
    if (!plan.valid || plan.action === 'skipped') skipped += 1;
    if (plan.action === 'conflict') conflicts += 1;

    let inventoryId: string | null = null;
    if (plan.valid && (plan.action === 'create' || plan.action === 'update')) {
      let locationId = plan.locationId;
      let locationName = plan.locationName;

      if (plan.part.location && !locationId) {
        try {
          const createdLocation = await target.createStorageLocation({
            store_id: context.storeId,
            name: plan.part.location,
            metadata,
          });
          locationId = createdLocation.id;
          locationName = createdLocation.name;
          locationsCreated += 1;
        } catch {
          plan.warnings.push('location_pending');
        }
      }

      const payload = buildInventoryPayload({
        part: plan.part,
        storeId: context.storeId,
        locationId,
        locationName,
        category: plan.category,
        categoryId: plan.categoryId,
        metadata,
      });

      if (plan.action === 'update' && plan.matchedId) {
        await target.updateInventoryItem(plan.matchedId, {
          ...payload,
          metadata: { ...metadata, testCreated: false },
        });
        inventoryId = plan.matchedId;
        updated += 1;
      } else {
        const result = await target.createInventoryItem(payload);
        inventoryId = result.id;
        created += 1;
      }

      for (const snapshot of plan.adSnapshots) {
        const mlbId = asString(snapshot.id);
        if (!mlbId) continue;
        await target.upsertMarketplaceAd({
          integration_id: options.integrationId,
          loja_id: context.storeId,
          peca_id: inventoryId,
          mlb_id: mlbId,
          data: snapshot,
          metadata,
        });
        adCreatedOrUpdated += 1;
      }
    }

    await target.createImportRunItem({
      runId: run.id,
      testRunId,
      row: plan.row,
      status: plan.action,
      type: plan.action,
      action: plan.action,
      code: plan.part.code ?? null,
      idInt: plan.part.id_int,
      idString: plan.part.id_string,
      mlbId: plan.mlbIds[0] ?? null,
      pecaId: inventoryId,
      messages: [],
      warnings: plan.warnings,
      errors: plan.errors,
      raw: plan.part.sourceRow ?? null,
      normalized: plan.part,
      metadata,
    });
  }

  return { runId: run.id, created, updated, skipped, conflicts, locationsCreated, adCreatedOrUpdated };
};

const main = async () => {
  loadLocalEnv();
  const options = parseArgs();
  const { uri, dbName } = getRequiredMongoEnv();
  const testRunId = `mongo-import-adapter-v1-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const client = new MongoClient(uri, {
    connectTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
  });

  try {
    await client.connect();
    const target = createMongoImportTarget(client.db(dbName));
    const context = await authenticate(options.integrationId);
    const plans = await buildPlan(target, context, options);
    const dryRun = summarize(plans);
    const gate = evaluateMongoImportQualityGate(dryRun, {
      write: options.mode === 'write',
      allowCategoryPending: options.allowCategoryPending,
    });

    console.log(JSON.stringify({
      mode: options.mode,
      target: target.name,
      testRunId,
      database: dbName,
      integrationId: options.integrationId,
      storeId: context.storeId,
      fileName: basename(options.file),
      dryRun,
      qualityGate: gate,
      warnings: plans.flatMap((plan) => plan.warnings.map((warning) => ({ row: plan.row, warning }))),
      errors: plans.flatMap((plan) => plan.errors.map((error) => ({ row: plan.row, error }))),
    }, null, 2));

    if (options.mode === 'write') {
      if (!gate.allowed) throw new Error(gate.errors.join(' '));
      const write = await writePlan(target, context, options, testRunId, plans);
      console.log(JSON.stringify({ write }, null, 2));
    }
  } finally {
    await client.close();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
