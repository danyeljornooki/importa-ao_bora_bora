import type { Db, Document } from 'mongodb';
import { evaluateMongoImportQualityGate } from '../../adapters/mongo/quality/mongoImportQualityGate';
import { MONGO_COLLECTIONS } from '../../adapters/mongo/client/collectionNames';
import { finalizeExecutionPlanLocations } from '../../core/locations/finalizeExecutionPlanLocations';
import { getPartRawLocation } from '../../core/locations/getPartRawLocation';
import type { StorageLocationAdapter } from '../../core/locations/storageLocationAdapter';
import type { MarketplaceAdapter } from '../../adapters/mercado-livre/mercadoLivreAdapter';
import type { ImportExecutionContext } from '../../types/integration.types';
import type { ImportHistoryAdapter } from '../../types/importHistory.types';
import type {
  ExistingInventoryItem,
  InventoryPersistenceAdapter,
  InventoryPersistencePayload,
  PersistenceActionResult,
} from '../../types/inventory.types';
import type { MarketplaceAdRegistryAdapter } from '../../types/marketplaceAd.types';
import type { PartCanonical } from '../../modules/importer/schemas/part.schema';
import type { PersistExecutionResult } from '../../modules/importer/persistence/persistExecutionPlan';
import type { RunImportResult } from '../runImport';
import { runImport } from '../runImport';
import {
  executePartImportWithComplements,
  type ExecutePartImportWithComplementsResult,
} from '../executePartImportWithComplements';
import {
  DEFAULT_IMPORT_TARGET,
  getDefaultImportTargetName,
  normalizeImportTargetName,
} from './selectImportTarget';
import {
  buildMongoImportMetadata,
  createMongoImportTarget,
  MONGO_IMPORT_ADAPTER_SOURCE,
} from './mongo/mongoImportTarget';
import type {
  ImportRunMode,
  ImportTargetName,
  ImportWriteTarget,
} from './types';

export const OFFICIAL_MONGO_IMPORT_SOURCE = 'official_import_target_mongo';

export interface OfficialImportWithTargetInput {
  fileBuffer: ArrayBuffer;
  fileName: string;
  executionContext: ImportExecutionContext;
  target?: ImportTargetName | string | null;
  mode?: ImportRunMode;
  allowCategoryPending?: boolean;
  testRunId?: string;
  rowFilters?: Parameters<typeof runImport>[1]['rowFilters'];
  columnMapping?: Parameters<typeof runImport>[1]['columnMapping'];
  debugMatching?: boolean;
  onProgress?: (progress: number) => void;
  supabase?: {
    inventoryAdapter: InventoryPersistenceAdapter;
    storageLocationAdapter?: StorageLocationAdapter | null;
    historyAdapter: ImportHistoryAdapter;
    adRegistryAdapter: MarketplaceAdRegistryAdapter;
    marketplaceAdapter: MarketplaceAdapter;
  };
  mongo?: {
    db?: Db;
    target?: ImportWriteTarget;
    inventoryAdapter?: InventoryPersistenceAdapter;
    fetchMarketplaceItem?: MarketplaceItemFetcher | null;
  };
}

export interface OfficialImportWithTargetResult {
  target: ImportTargetName;
  mode: ImportRunMode;
  runId: string | null;
  testRunId: string | null;
  fileName: string;
  integrationId: string;
  storeId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  created: number;
  updated: number;
  skipped: number;
  conflicts: number;
  warnings: number;
  errors: string[];
  dryRun: RunImportResult;
  wroteDocuments: boolean;
  write?: {
    inventoryCreated: number;
    inventoryUpdated: number;
    storageLocationsCreated: number;
    marketplaceAdsUpserted: number;
    importRunItemsCreated: number;
  };
  supabaseCommit?: ExecutePartImportWithComplementsResult;
}

export type MarketplaceItemFetchResult =
  | { status: 'found'; data: Document }
  | { status: 'no_access' }
  | { status: 'not_found' }
  | { status: 'error'; error: string };

export type MarketplaceItemFetcher = (
  mlbId: string
) => Promise<MarketplaceItemFetchResult>;

const asString = (value: unknown): string | null =>
  value === null || value === undefined || String(value).trim() === ''
    ? null
    : String(value).trim();

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeName = (value: unknown): string | null => {
  const text = asString(value);
  if (!text) return null;
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
};

const mongoDocId = (doc: Record<string, unknown>): string =>
  String(doc.id ?? doc._id ?? '');

const mapMongoInventoryItem = (doc: Record<string, unknown>): ExistingInventoryItem => ({
  id: mongoDocId(doc),
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

export const createMongoInventoryPersistenceAdapter = (
  db: Db
): InventoryPersistenceAdapter => ({
  async loadStoreInventory(storeId: string): Promise<ExistingInventoryItem[]> {
    const docs = await db.collection(MONGO_COLLECTIONS.inventoryItems)
      .find(
        { store_id: String(storeId), deleted: { $ne: true } },
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
      .toArray();

    return docs.map((doc) => mapMongoInventoryItem(doc as Record<string, unknown>));
  },

  async createItem(): Promise<PersistenceActionResult> {
    return {
      success: false,
      error: 'Use mongoImportTarget para write Mongo oficial.',
    };
  },

  async updateItem(): Promise<PersistenceActionResult> {
    return {
      success: false,
      error: 'Use mongoImportTarget para write Mongo oficial.',
    };
  },
});

const resolveTargetName = (target?: ImportTargetName | string | null): ImportTargetName => {
  if (target) return normalizeImportTargetName(target);
  return getDefaultImportTargetName();
};

export const resolveOfficialImportTargetName = (
  target?: ImportTargetName | string | null
): ImportTargetName => resolveTargetName(target);

const ensureMongoExplicitForWrite = (
  input: OfficialImportWithTargetInput,
  target: ImportTargetName,
  mode: ImportRunMode
) => {
  if (target !== 'mongo' || mode !== 'write') return;
  if (input.target !== 'mongo') {
    throw new Error('Write Mongo bloqueado: informe target=mongo explicitamente.');
  }
};

const metadataForMongo = (input: {
  testRunId?: string | null;
  runId?: string;
  integrationId: string;
  fileName: string;
  importedAt: Date;
}) => ({
  ...buildMongoImportMetadata({
    testRunId: input.testRunId ?? undefined,
    runId: input.runId,
    integrationId: input.integrationId,
    fileName: input.fileName,
    importedAt: input.importedAt,
  }),
  source: OFFICIAL_MONGO_IMPORT_SOURCE,
  target: 'mongo',
  adapterSource: MONGO_IMPORT_ADAPTER_SOURCE,
});

const partByRow = (analysisResult: RunImportResult): Map<number, PartCanonical> =>
  new Map(
    analysisResult.importPlan.actions.flatMap((action) =>
      action.data ? [[action.row, action.data] as const] : []
    )
  );

const mlbIdsOf = (part: PartCanonical | undefined): string[] =>
  [...new Set((part?.mlb_ids ?? []).filter((id): id is string => Boolean(id)))];

const enrichPayload = (payload: Document, category: Document | null, categoryId: string | null): Document => {
  if (!category) return payload;
  return {
    ...payload,
    part_category_id: category._id ? String(category._id) : asString(category.id),
    part_category_name: asString(category.nome ?? category.name),
    mercado_libre_brasil_category_id: categoryId,
    catalog_attributes: category.catalogo_attributes ?? category.catalog_attributes ?? [],
    package_height: category.embalagemAltura ?? category.altura ?? null,
    package_width: category.embalagemLargura ?? category.largura ?? null,
    package_length: category.embalagemComprimento ?? category.comprimento ?? null,
    package_weight: category.embalagemPeso ?? category.peso ?? null,
    shopee_category_id: category.shopee_category_id ?? null,
    shopee_brand_id: category.shopee_brand_id ?? null,
    vehicle_type: category.vehicle_type ?? null,
    compatibilities_restrictions: category.compatibilities_restrictions ?? null,
  };
};

const applyLocationToPayload = async (
  target: ImportWriteTarget,
  payload: Document,
  part: PartCanonical | undefined,
  storeId: string,
  metadata: Document,
  write: boolean
): Promise<{ payload: Document; created: boolean; warning: string | null }> => {
  const rawLocation = getPartRawLocation(part);
  if (!rawLocation) return { payload, created: false, warning: null };

  try {
    const found = await target.findStorageLocation({ storeId, name: rawLocation });
    const location = found ?? (write
      ? await target.createStorageLocation({
          store_id: storeId,
          name: rawLocation,
          status: 'active',
          metadata,
        })
      : null);

    if (!location) {
      return {
        payload: {
          ...payload,
          storage_location_name: rawLocation,
          storage_location_source: 'pending',
        },
        created: false,
        warning: 'location_pending',
      };
    }

    return {
      payload: {
        ...payload,
        storage_location_id: location.id,
        storage_location_name: location.name,
        storage_location_source: 'linked',
      },
      created: !found,
      warning: null,
    };
  } catch {
    return {
      payload: {
        ...payload,
        storage_location_name: rawLocation,
        storage_location_source: 'pending',
      },
      created: false,
      warning: 'location_pending',
    };
  }
};

const inspectMongoReferences = async (
  analysisResult: RunImportResult,
  target: ImportWriteTarget,
  fetchMarketplaceItem: MarketplaceItemFetcher | null
) => {
  const parts = partByRow(analysisResult);
  let categoriesFound = 0;
  let categoriesMissing = 0;
  const categoryByRow = new Map<number, { categoryId: string | null; category: Document | null; warnings: string[]; ads: Document[] }>();
  const mlCache = new Map<string, MarketplaceItemFetchResult>();

  for (const [row, part] of parts) {
    const warnings: string[] = [];
    const ads: Document[] = [];
    let categoryId: string | null = null;

    for (const mlbId of mlbIdsOf(part)) {
      if (!fetchMarketplaceItem) continue;
      let result = mlCache.get(mlbId);
      if (!result) {
        result = await fetchMarketplaceItem(mlbId);
        mlCache.set(mlbId, result);
      }
      if (result.status === 'found') {
        ads.push(result.data);
        categoryId ??= asString(result.data.category_id);
      } else if (result.status === 'not_found') {
        warnings.push(`ad_not_found:${mlbId}`);
      } else if (result.status === 'no_access') {
        warnings.push(`ad_no_access:${mlbId}`);
      } else {
        warnings.push(`ad_fetch_error:${mlbId}`);
      }
    }

    let category: Document | null = null;
    if (categoryId) {
      category = (await target.findPartCategory({ categoryId }))?.raw ?? null;
      if (category) categoriesFound += 1;
      else {
        categoriesMissing += 1;
        warnings.push(`category_pending:${categoryId}`);
      }
    }

    categoryByRow.set(row, { categoryId, category, warnings, ads });
  }

  return { categoriesFound, categoriesMissing, categoryByRow };
};

const emptyPersistResult = (analysisResult: RunImportResult): PersistExecutionResult => ({
  total: analysisResult.executionPlan.summary.executable,
  created: 0,
  updated: 0,
  skipped: analysisResult.executionPlan.summary.skipped,
  conflicts: analysisResult.executionPlan.summary.conflicts,
  invalid: analysisResult.executionPlan.summary.invalid,
  failed: 0,
  errors: [],
  rows: [],
});

const executeMongoWrite = async (
  input: OfficialImportWithTargetInput,
  target: ImportWriteTarget,
  analysisResult: RunImportResult,
  references: Awaited<ReturnType<typeof inspectMongoReferences>>,
  testRunId: string
) => {
  const importedAt = new Date();
  const baseMetadata = metadataForMongo({
    testRunId,
    integrationId: input.executionContext.integrationId,
    fileName: input.fileName,
    importedAt,
  }) as ReturnType<typeof metadataForMongo> & { testCreated: boolean };
  baseMetadata.testCreated = true;

  const run = await target.createImportRun({
    testRunId,
    storeId: input.executionContext.storeId,
    integrationId: input.executionContext.integrationId,
    fileName: input.fileName,
    target: 'mongo',
    status: 'running',
    mode: 'write',
    totalRows: analysisResult.summary.totalRows,
    validRows: analysisResult.summary.valid,
    invalidRows: analysisResult.summary.invalid,
    createdCount: analysisResult.summary.creates,
    updatedCount: analysisResult.summary.updates,
    skippedCount: analysisResult.summary.skipped,
    conflictCount: analysisResult.summary.conflicts,
    warningCount: analysisResult.summary.warnings,
    metadata: baseMetadata,
  });
  const metadata = { ...baseMetadata, runId: run.id };
  const parts = partByRow(analysisResult);
  let inventoryCreated = 0;
  let inventoryUpdated = 0;
  let storageLocationsCreated = 0;
  let marketplaceAdsUpserted = 0;
  let importRunItemsCreated = 0;
  const errors: string[] = [];

  for (const action of analysisResult.executionPlan.actions) {
    const part = parts.get(action.row);
    const reference = references.categoryByRow.get(action.row);
    const warnings = [...new Set([...(action.warnings ?? []), ...(reference?.warnings ?? [])])];
    let pecaId = action.targetId ?? null;
    let status = action.type;

    try {
      if ((action.type === 'create' || action.type === 'update') && action.payload) {
        const location = await applyLocationToPayload(
          target,
          action.payload as Document,
          part,
          input.executionContext.storeId,
          metadata,
          true
        );
        if (location.created) storageLocationsCreated += 1;
        if (location.warning) warnings.push(location.warning);

        const payload = {
          ...enrichPayload(location.payload, reference?.category ?? null, reference?.categoryId ?? null),
          metadata: action.type === 'update'
            ? { ...metadata, testCreated: false }
            : metadata,
        };

        if (action.type === 'update' && action.targetId) {
          await target.updateInventoryItem(action.targetId, payload);
          pecaId = action.targetId;
          inventoryUpdated += 1;
          status = 'update';
        } else {
          const created = await target.createInventoryItem(payload);
          pecaId = created.id;
          inventoryCreated += 1;
          status = 'create';
        }

        for (const ad of reference?.ads ?? []) {
          const mlbId = asString(ad.id);
          if (!mlbId) continue;
          await target.upsertMarketplaceAd({
            integration_id: input.executionContext.integrationId,
            loja_id: input.executionContext.storeId,
            peca_id: pecaId,
            mlb_id: mlbId,
            data: ad,
            metadata,
          });
          marketplaceAdsUpserted += 1;
        }
      }
    } catch (error) {
      status = 'invalid';
      errors.push(error instanceof Error ? error.message : String(error));
    }

    await target.createImportRunItem({
      runId: run.id,
      testRunId,
      row: action.row,
      status,
      type: action.type,
      action: action.type,
      code: part?.code ?? null,
      idInt: part?.id_int ?? null,
      idString: part?.id_string ?? null,
      mlbId: mlbIdsOf(part)[0] ?? null,
      pecaId,
      messages: [],
      warnings: [...new Set(warnings)],
      errors: status === 'invalid' ? errors.slice(-1) : [],
      raw: part?.sourceRow ?? null,
      normalized: part ?? null,
      metadata,
    });
    importRunItemsCreated += 1;
  }

  await target.updateImportRun(run.id, {
    status: errors.length > 0 ? 'completed_with_errors' : 'completed',
    completed_at: new Date(),
    created_count: inventoryCreated,
    updated_count: inventoryUpdated,
    warning_count: analysisResult.summary.warnings,
    error_count: errors.length,
  });

  return {
    runId: run.id,
    errors,
    write: {
      inventoryCreated,
      inventoryUpdated,
      storageLocationsCreated,
      marketplaceAdsUpserted,
      importRunItemsCreated,
    },
  };
};

export const executeOfficialImportWithTarget = async (
  input: OfficialImportWithTargetInput
): Promise<OfficialImportWithTargetResult> => {
  const mode = input.mode ?? 'dryRun';
  const target = resolveTargetName(input.target);
  ensureMongoExplicitForWrite(input, target, mode);

  if (target === DEFAULT_IMPORT_TARGET) {
    if (!input.supabase) {
      throw new Error('Adapters Supabase obrigatorios para importacao oficial Supabase.');
    }

    const dryRun = await runImport(input.fileBuffer, {
      storeId: input.executionContext.storeId,
      adapter: input.supabase.inventoryAdapter,
      integrationId: input.executionContext.integrationId,
      fileName: input.fileName,
      debugMatching: input.debugMatching,
      rowFilters: input.rowFilters,
      columnMapping: input.columnMapping,
      storageLocationAdapter: null,
    });

    if (mode !== 'write') {
      return buildResult(input, target, mode, dryRun, null, [], false);
    }

    const commit = await executePartImportWithComplements({
      analysisResult: dryRun,
      executionContext: input.executionContext,
      inventoryAdapter: input.supabase.inventoryAdapter,
      storageLocationAdapter: input.supabase.storageLocationAdapter ?? null,
      historyAdapter: input.supabase.historyAdapter,
      adRegistryAdapter: input.supabase.adRegistryAdapter,
      marketplaceAdapter: input.supabase.marketplaceAdapter,
      options: {
        fileName: input.fileName,
        adapterName: 'supabase',
        engineVersion: '1.1.0',
        onProgress: input.onProgress,
        metadata: { target: 'supabase' },
      },
    });

    return buildResult(input, target, mode, dryRun, commit.runId, [], true, {
      supabaseCommit: commit,
      created: commit.persistResult.created,
      updated: commit.persistResult.updated,
      skipped: commit.persistResult.skipped,
      conflicts: commit.persistResult.conflicts,
    });
  }

  const mongoTarget = input.mongo?.target ?? (input.mongo?.db ? createMongoImportTarget(input.mongo.db) : null);
  const mongoInventoryAdapter = input.mongo?.inventoryAdapter
    ?? (input.mongo?.db ? createMongoInventoryPersistenceAdapter(input.mongo.db) : null);
  if (!mongoTarget || !mongoInventoryAdapter) {
    throw new Error('Mongo target e inventoryAdapter obrigatorios para target=mongo.');
  }

  const dryRun = await runImport(input.fileBuffer, {
    storeId: input.executionContext.storeId,
    adapter: mongoInventoryAdapter,
    integrationId: input.executionContext.integrationId,
    fileName: input.fileName,
    debugMatching: input.debugMatching,
    rowFilters: input.rowFilters,
    columnMapping: input.columnMapping,
    storageLocationAdapter: null,
  });
  const references = await inspectMongoReferences(
    dryRun,
    mongoTarget,
    input.mongo?.fetchMarketplaceItem ?? null
  );
  const warnings =
    dryRun.summary.warnings +
    Array.from(references.categoryByRow.values()).reduce((total, row) => total + row.warnings.length, 0);
  const gateSummary = {
    totalRows: dryRun.summary.totalRows,
    valid: dryRun.summary.valid,
    invalid: dryRun.summary.invalid,
    creates: dryRun.summary.creates,
    updates: dryRun.summary.updates,
    skipped: dryRun.summary.skipped,
    conflicts: dryRun.summary.conflicts,
    warnings,
    categoriesFound: references.categoriesFound,
    categoriesMissing: references.categoriesMissing,
    locationsFound: 0,
    locationsWouldCreate: 0,
    mlbFound: 0,
    mlbNoAccess: 0,
    mlbNotFound: 0,
  };
  const gate = evaluateMongoImportQualityGate(gateSummary, {
    write: mode === 'write',
    allowCategoryPending: input.allowCategoryPending === true,
  });

  if (mode !== 'write') {
    return buildResult(input, target, mode, dryRun, null, gate.errors, false, {
      warnings,
    });
  }

  if (!gate.allowed) {
    throw new Error(gate.errors.join(' '));
  }

  const testRunId =
    input.testRunId ?? `official-import-mongo-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const write = await executeMongoWrite(input, mongoTarget, dryRun, references, testRunId);
  return buildResult(input, target, mode, dryRun, write.runId, write.errors, true, {
    testRunId,
    warnings,
    created: write.write.inventoryCreated,
    updated: write.write.inventoryUpdated,
    write: write.write,
  });
};

const buildResult = (
  input: OfficialImportWithTargetInput,
  target: ImportTargetName,
  mode: ImportRunMode,
  dryRun: RunImportResult,
  runId: string | null,
  errors: string[],
  wroteDocuments: boolean,
  overrides: Partial<OfficialImportWithTargetResult> = {}
): OfficialImportWithTargetResult => ({
  target,
  mode,
  runId,
  testRunId: overrides.testRunId ?? input.testRunId ?? null,
  fileName: input.fileName,
  integrationId: input.executionContext.integrationId,
  storeId: input.executionContext.storeId,
  totalRows: dryRun.summary.totalRows,
  validRows: dryRun.summary.valid,
  invalidRows: dryRun.summary.invalid,
  created: overrides.created ?? dryRun.summary.creates,
  updated: overrides.updated ?? dryRun.summary.updates,
  skipped: overrides.skipped ?? dryRun.summary.skipped,
  conflicts: overrides.conflicts ?? dryRun.summary.conflicts,
  warnings: overrides.warnings ?? dryRun.summary.warnings,
  errors,
  dryRun,
  wroteDocuments,
  write: overrides.write,
  supabaseCommit: overrides.supabaseCommit,
});

export const shouldShowImportTargetSwitch = (): boolean =>
  process.env.NEXT_PUBLIC_ENABLE_IMPORT_TARGET_SWITCH === 'true'
  || process.env.NEXT_PUBLIC_SHOW_DEV_LINKS === 'true';
