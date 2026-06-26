import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { ObjectId, MongoClient, type Db, type Document } from 'mongodb';
import { getRequiredMongoEnv } from '../src/adapters/mongo/mongoEnv';
import { MONGO_COLLECTIONS } from '../src/adapters/mongo/collectionNames';
import { parseImportFile } from '../src/modules/importer/parseImportFile';
import { normalizePart } from '../src/modules/importer/normalizePart';
import { validatePart } from '../src/modules/importer/validators/validatePart';
import { matchPart } from '../src/modules/importer/matchers/matchPart';
import { evaluateMongoImportQualityGate } from '../src/adapters/mongo/mongoImportQualityGate';
import type { ExistingInventoryItem } from '../src/types/inventory.types';
import type { PartCanonical } from '../src/modules/importer/schemas/part.schema';

const SOURCE = 'real_20_parts_mongo_test';
const AUTHENTICATION_URL =
  'https://n8n.driveparts.virtuaserver.com.br/webhook/mercado-livre-brasil/authentication';

interface Options {
  file: string;
  integrationId: string;
  write: boolean;
  allowCategoryPending: boolean;
}

interface MlContext {
  storeId: string;
  accessToken: string | null;
  userId: number | null;
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
  categoryFound: boolean;
  locationFound: boolean;
  locationWouldCreate: boolean;
  storageLocationId: string | null;
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

const unquote = (value: string): string =>
  value.trim().replace(/^['"]|['"]$/g, '');

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
  const allowCategoryPending = args.includes('--allow-category-pending');

  if (!file) throw new Error('Informe --file=<caminho_da_planilha>.');
  if (!integrationId) throw new Error('Informe --integrationId=<id>.');

  return {
    file: unquote(file),
    integrationId: unquote(integrationId),
    write,
    allowCategoryPending,
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
      userId: asNumber(mercadoLivre?.user_id),
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
      'User-Agent': 'DriveParts-MongoTest/1.0',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (response.status === 403 || response.status === 401) return { status: 'no_access' };
  if (response.status === 404) return { status: 'not_found' };
  if (!response.ok) return { status: 'no_access' };

  return { status: 'found', data: await response.json() as Document };
};

const toExistingInventory = (doc: Document): ExistingInventoryItem & { mongoId: unknown } => ({
  mongoId: doc._id,
  id: String(doc.id ?? doc._id),
  store_id: String(doc.store_id ?? ''),
  id_int: asNumber(doc.id_int),
  id_string: asString(doc.id_string),
  primary_anuncio_mlb_id: asString(doc.primary_anuncio_mlb_id),
  code: asString(doc.code),
  tag_code: asString(doc.tag_code),
  marketplace_name: asString(doc.marketplace_name),
  title: asString(doc.marketplace_name),
  storage_location_id: asString(doc.storage_location_id),
  storage_location_name: asString(doc.storage_location_name),
  status: asString(doc.status),
  deleted: Boolean(doc.deleted),
  price: asNumber(doc.price),
  stock_quantity: asNumber(doc.stock_quantity),
  raw: doc,
});

const normalizeName = (value: unknown): string | null => {
  const text = asString(value);
  if (!text) return null;
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
};

const metadataFor = (
  testRunId: string,
  integrationId: string,
  fileName: string,
  testCreated: boolean
) => ({
  source: SOURCE,
  testRunId,
  integrationId,
  fileName,
  testCreated,
});

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
    package_height: category.altura ?? null,
    package_width: category.largura ?? null,
    package_length: category.comprimento ?? null,
    package_weight: category.peso ?? null,
    shopee_category_id: category.shopee_category_id ?? null,
    shopee_brand_id: category.shopee_brand_id ?? null,
    vehicle_type: category.vehicle_type ?? null,
    compatibilities_restrictions: category.compatibilities_restrictions ?? null,
    primary_anuncio_mlb_id: mlbId,
    image_ids: [],
    images,
    image_count: images.length,
    metadata: input.metadata,
    updated_at: new Date(),
  };
};

const ensureStorageLocation = async (
  db: Db,
  options: {
    storeId: string;
    name: string | null | undefined;
    write: boolean;
    metadata: Record<string, unknown>;
  }
): Promise<{ found: boolean; wouldCreate: boolean; id: string | null; name: string | null }> => {
  const name = asString(options.name);
  if (!name) return { found: false, wouldCreate: false, id: null, name: null };

  const collection = db.collection(MONGO_COLLECTIONS.storageLocations);
  const existing = await collection.findOne({
    store_id: options.storeId,
    name,
    status: 'active',
  });

  if (existing) {
    return { found: true, wouldCreate: false, id: String(existing.id ?? existing._id), name };
  }

  if (!options.write) {
    return { found: false, wouldCreate: true, id: null, name };
  }

  const now = new Date();
  const inserted = await collection.insertOne({
    store_id: options.storeId,
    name,
    abbreviation: name,
    status: 'active',
    created_at: now,
    updated_at: now,
    location_path_names: [name],
    location_path_slugs: [normalizeName(name)],
    location_path_key: normalizeName(name),
    location_path_prefixes: [normalizeName(name)],
    location_path_text: name,
    location_path_depth: 1,
    location_path_character_count: name.length,
    path_text: name,
    level: 0,
    metadata: options.metadata,
  });

  const id = String(inserted.insertedId);
  await collection.updateOne(
    { _id: inserted.insertedId },
    {
      $set: {
        id,
        path: id,
        path_ids: [id],
        path_items: [{
          storage_location_id: id,
          name,
          abbreviation: name,
          storage_location_type_id: null,
          storage_location_type_name: null,
          icon_key: null,
          color_key: null,
        }],
      },
    }
  );

  return { found: false, wouldCreate: true, id, name };
};

const buildPlan = async (
  db: Db,
  context: MlContext,
  options: Options,
  testRunId: string
): Promise<RowPlan[]> => {
  const buffer = readFileSync(options.file);
  const fileName = basename(options.file);
  const parsed = await parseImportFile(buffer, { fileName });
  const inventory = (await db.collection(MONGO_COLLECTIONS.inventoryItems)
    .find({ store_id: context.storeId, deleted: { $ne: true } })
    .limit(50000)
    .toArray())
    .map(toExistingInventory);

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
        categoryFound: false,
        locationFound: false,
        locationWouldCreate: false,
        storageLocationId: null,
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
    const match = validation.valid ? matchPart(part, inventory) : null;
    if (match?.warnings.length) warnings.push(...match.warnings);

    const metadata = metadataFor(testRunId, options.integrationId, fileName, true);
    const location = await ensureStorageLocation(db, {
      storeId: context.storeId,
      name: part.location,
      write: false,
      metadata,
    });
    if (part.location && !location.id && !location.wouldCreate) {
      warnings.push('location_pending');
    }

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
      category = await db.collection(MONGO_COLLECTIONS.parte).findOne({ MLB_categoria_id: categoryId });
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
      action: !validation.valid
        ? 'skipped'
        : match?.action === 'conflict'
          ? 'conflict'
          : match?.action ?? 'create',
      matchedId: match?.existingPart?.id ?? null,
      categoryId,
      categoryFound: Boolean(category),
      locationFound: location.found,
      locationWouldCreate: location.wouldCreate,
      storageLocationId: location.id,
      mlbIds: part.mlb_ids ?? [],
      mlbFound,
      mlbNoAccess,
      mlbNotFound,
      adSnapshots,
    });
  }

  return plans;
};

const writePlan = async (
  db: Db,
  context: MlContext,
  options: Options,
  testRunId: string,
  plans: RowPlan[]
) => {
  const fileName = basename(options.file);
  const metadata = metadataFor(testRunId, options.integrationId, fileName, true);
  const now = new Date();
  const run = await db.collection(MONGO_COLLECTIONS.importRuns).insertOne({
    store_id: context.storeId,
    status: 'completed',
    file_name: fileName,
    total_rows: plans.length,
    metadata,
    created_at: now,
    updated_at: now,
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let conflicts = 0;
  let adCreatedOrUpdated = 0;

  for (const plan of plans) {
    if (!plan.valid || plan.action === 'skipped') skipped += 1;
    if (plan.action === 'conflict') conflicts += 1;

    let inventoryId: string | null = null;
    if (plan.valid && (plan.action === 'create' || plan.action === 'update')) {
      const location = await ensureStorageLocation(db, {
        storeId: context.storeId,
        name: plan.part.location,
        write: true,
        metadata,
      });
      const category = plan.categoryId
        ? await db.collection(MONGO_COLLECTIONS.parte).findOne({ MLB_categoria_id: plan.categoryId })
        : null;
      const payload = buildInventoryPayload({
        part: plan.part,
        storeId: context.storeId,
        locationId: location.id,
        locationName: location.name ?? plan.part.location ?? null,
        category,
        categoryId: plan.categoryId,
        metadata,
      });

      if (plan.action === 'update' && plan.matchedId) {
        const idFilter = ObjectId.isValid(plan.matchedId)
          ? { _id: new ObjectId(plan.matchedId) }
          : { id: plan.matchedId };
        await db.collection(MONGO_COLLECTIONS.inventoryItems).updateOne(idFilter, {
          $set: { ...payload, metadata: metadataFor(testRunId, options.integrationId, fileName, false) },
        });
        inventoryId = plan.matchedId;
        updated += 1;
      } else {
        const result = await db.collection(MONGO_COLLECTIONS.inventoryItems).insertOne({
          ...payload,
          created_at: now,
        });
        inventoryId = String(result.insertedId);
        await db.collection(MONGO_COLLECTIONS.inventoryItems).updateOne(
          { _id: result.insertedId },
          { $set: { id: inventoryId } }
        );
        created += 1;
      }

      for (const snapshot of plan.adSnapshots) {
        const mlbId = asString(snapshot.id);
        if (!mlbId) continue;
        await db.collection(MONGO_COLLECTIONS.mercadoLivreBrasilAnuncio).updateOne(
          { integration_id: options.integrationId, mlb_id: mlbId },
          {
            $set: {
              integration_id: options.integrationId,
              peca_id: inventoryId,
              loja_id: context.storeId,
              mlb_id: mlbId,
              data: snapshot,
              metadata,
              updated_at: now,
            },
            $setOnInsert: { created_at: now },
          },
          { upsert: true }
        );
        adCreatedOrUpdated += 1;
      }
    }

    await db.collection(MONGO_COLLECTIONS.importRunItems).insertOne({
      run_id: String(run.insertedId),
      row: plan.row,
      status: plan.action,
      type: plan.action,
      store_id: context.storeId,
      peca_id: inventoryId,
      mlb_id: plan.mlbIds[0] ?? null,
      errors: plan.errors,
      warnings: plan.warnings,
      metadata,
      created_at: now,
    });
  }

  return { runId: String(run.insertedId), created, updated, skipped, conflicts, adCreatedOrUpdated };
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

const main = async () => {
  loadLocalEnv();
  const options = parseArgs();
  const { uri, dbName } = getRequiredMongoEnv();
  const testRunId = `mongo-real-20-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const client = new MongoClient(uri, {
    connectTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
  });

  try {
    await client.connect();
    const db = client.db(dbName);
    const context = await authenticate(options.integrationId);
    const plans = await buildPlan(db, context, options, testRunId);
    const dryRun = summarize(plans);
    const gate = evaluateMongoImportQualityGate(dryRun, {
      write: options.write,
      allowCategoryPending: options.allowCategoryPending,
    });
    console.log(JSON.stringify({
      mode: options.write ? 'write' : 'dryRun',
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

    if (options.write) {
      if (!gate.allowed) {
        throw new Error(gate.errors.join(' '));
      }
      const write = await writePlan(db, context, options, testRunId, plans);
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
