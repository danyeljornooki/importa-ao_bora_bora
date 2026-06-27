import { ObjectId, type Db, type Document, type Filter } from 'mongodb';
import { MONGO_COLLECTIONS } from '../../../adapters/mongo/client/collectionNames';
import type {
  ImportRunItemPayload,
  ImportRunPayload,
  ImportWriteTarget,
  InventoryMatchInput,
  MarketplaceAdInput,
  StorageLocationInput,
} from '../types';

export const MONGO_IMPORT_ADAPTER_SOURCE = 'mongo_import_adapter_v1';

const asString = (value: unknown): string | null =>
  value === null || value === undefined || String(value).trim() === ''
    ? null
    : String(value).trim();

const normalizeName = (value: unknown): string | null => {
  const text = asString(value);
  if (!text) return null;
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
};

const compact = <T>(items: Array<T | null | undefined | false>): T[] =>
  items.filter(Boolean) as T[];

export const buildMongoInventoryMatchFilters = (
  input: InventoryMatchInput
): Array<{ matchedBy: string; filter: Filter<Document> }> => {
  const storeFilter = { store_id: input.storeId, deleted: { $ne: true } };
  const identifierKeys = Array.isArray(input.identifierSearchKeys)
    ? input.identifierSearchKeys.filter(Boolean)
    : [];
  const mlbIds = Array.isArray(input.mlbIds) ? input.mlbIds.filter(Boolean) : [];

  return compact([
    input.idInt !== null && input.idInt !== undefined
      ? { matchedBy: 'id_int', filter: { ...storeFilter, id_int: input.idInt } }
      : null,
    input.idString
      ? { matchedBy: 'id_string', filter: { ...storeFilter, id_string: input.idString } }
      : null,
    input.code
      ? { matchedBy: 'code', filter: { ...storeFilter, code: input.code } }
      : null,
    input.tagCode
      ? { matchedBy: 'tag_code', filter: { ...storeFilter, tag_code: input.tagCode } }
      : null,
    identifierKeys.length > 0
      ? {
          matchedBy: 'identifier_search_keys',
          filter: { ...storeFilter, identifier_search_keys: { $in: identifierKeys } },
        }
      : null,
    mlbIds.length > 0
      ? {
          matchedBy: 'mlb_id',
          filter: {
            ...storeFilter,
            $or: [
              { primary_anuncio_mlb_id: { $in: mlbIds } },
              { id_string: { $in: mlbIds } },
              { 'integrations.mercado_livre_brasil.mlb_id': { $in: mlbIds } },
            ],
          },
        }
      : null,
  ]);
};

export const buildMongoStorageLocationFilter = (
  input: StorageLocationInput
): Filter<Document> => ({
  store_id: input.storeId,
  name: input.name,
  status: 'active',
});

export const buildMongoMarketplaceAdFilter = (
  input: MarketplaceAdInput
): Filter<Document> => ({
  integration_id: input.integrationId,
  $or: [
    { mlb_id: input.mlbId },
    { 'data.id': input.mlbId },
  ],
});

export const buildMongoImportMetadata = (input: {
  testRunId?: string;
  runId?: string;
  integrationId?: string | null;
  fileName?: string | null;
  importedAt?: Date;
}) => ({
  source: MONGO_IMPORT_ADAPTER_SOURCE,
  testRunId: input.testRunId,
  runId: input.runId,
  integrationId: input.integrationId ?? undefined,
  fileName: input.fileName ?? undefined,
  importedAt: input.importedAt ?? new Date(),
});

export const buildMongoImportRunItemDocument = (
  payload: ImportRunItemPayload,
  createdAt: Date = new Date()
): Document => ({
  run_id: payload.runId,
  testRunId: payload.testRunId ?? payload.metadata.testRunId,
  row: payload.row,
  status: payload.status,
  type: payload.type,
  action: payload.action,
  code: payload.code ?? null,
  id_int: payload.idInt ?? null,
  id_string: payload.idString ?? null,
  mlb_id: payload.mlbId ?? null,
  peca_id: payload.pecaId ?? null,
  messages: payload.messages ?? [],
  warnings: payload.warnings ?? [],
  errors: payload.errors ?? [],
  raw: payload.raw ?? null,
  normalized: payload.normalized ?? null,
  created_at: createdAt,
  metadata: payload.metadata,
});

const idFilter = (id: string): Filter<Document> =>
  ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { id };

const makeStorageLocationPayload = (payload: Document): Document => {
  const now = new Date();
  const name = asString(payload.name) ?? '';
  const key = normalizeName(name);
  return {
    ...payload,
    status: payload.status ?? 'active',
    abbreviation: payload.abbreviation ?? name,
    created_at: payload.created_at ?? now,
    updated_at: payload.updated_at ?? now,
    location_path_names: payload.location_path_names ?? [name],
    location_path_slugs: payload.location_path_slugs ?? [key],
    location_path_key: payload.location_path_key ?? key,
    location_path_prefixes: payload.location_path_prefixes ?? [key],
    location_path_text: payload.location_path_text ?? name,
    location_path_depth: payload.location_path_depth ?? 1,
    location_path_character_count: payload.location_path_character_count ?? name.length,
    path_text: payload.path_text ?? name,
    level: payload.level ?? 0,
  };
};

export const createMongoImportTarget = (db: Db): ImportWriteTarget => ({
  name: 'mongo',

  async createImportRun(payload: ImportRunPayload) {
    const now = new Date();
    const result = await db.collection(MONGO_COLLECTIONS.importRuns).insertOne({
      testRunId: payload.testRunId ?? payload.metadata.testRunId,
      store_id: payload.storeId,
      integration_id: payload.integrationId ?? null,
      file_name: payload.fileName ?? null,
      target: 'mongo',
      status: payload.status,
      mode: payload.mode,
      total_rows: payload.totalRows,
      valid_rows: payload.validRows,
      invalid_rows: payload.invalidRows,
      created_count: payload.createdCount,
      updated_count: payload.updatedCount,
      skipped_count: payload.skippedCount,
      conflict_count: payload.conflictCount,
      warning_count: payload.warningCount,
      created_at: now,
      updated_at: now,
      metadata: payload.metadata,
    });
    const id = String(result.insertedId);
    await db.collection(MONGO_COLLECTIONS.importRuns).updateOne(
      { _id: result.insertedId },
      { $set: { id, 'metadata.runId': id } }
    );
    return { id };
  },

  async updateImportRun(runId: string, patch: Record<string, unknown>) {
    await db.collection(MONGO_COLLECTIONS.importRuns).updateOne(
      idFilter(runId),
      { $set: { ...patch, updated_at: new Date() } }
    );
  },

  async createImportRunItem(payload: ImportRunItemPayload) {
    const result = await db.collection(MONGO_COLLECTIONS.importRunItems)
      .insertOne(buildMongoImportRunItemDocument(payload));
    return { id: String(result.insertedId) };
  },

  async findInventoryItem(input: InventoryMatchInput) {
    for (const candidate of buildMongoInventoryMatchFilters(input)) {
      const found = await db.collection(MONGO_COLLECTIONS.inventoryItems).findOne(candidate.filter);
      if (found) {
        return {
          id: String(found.id ?? found._id),
          raw: found,
          matchedBy: candidate.matchedBy,
        };
      }
    }
    return null;
  },

  async createInventoryItem(payload: Document) {
    const now = new Date();
    const result = await db.collection(MONGO_COLLECTIONS.inventoryItems).insertOne({
      ...payload,
      created_at: payload.created_at ?? now,
      updated_at: payload.updated_at ?? now,
    });
    const id = String(result.insertedId);
    await db.collection(MONGO_COLLECTIONS.inventoryItems).updateOne(
      { _id: result.insertedId },
      { $set: { id } }
    );
    return { id };
  },

  async updateInventoryItem(id: string, patch: Document) {
    await db.collection(MONGO_COLLECTIONS.inventoryItems).updateOne(
      idFilter(id),
      { $set: { ...patch, updated_at: new Date() } }
    );
    return { id };
  },

  async findStorageLocation(input: StorageLocationInput) {
    const found = await db.collection(MONGO_COLLECTIONS.storageLocations)
      .findOne(buildMongoStorageLocationFilter(input));
    if (!found) return null;
    return {
      id: String(found.id ?? found._id),
      name: asString(found.name) ?? input.name,
      raw: found,
    };
  },

  async createStorageLocation(payload: Document) {
    const insertPayload = makeStorageLocationPayload(payload);
    const result = await db.collection(MONGO_COLLECTIONS.storageLocations).insertOne(insertPayload);
    const id = String(result.insertedId);
    const name = asString(insertPayload.name) ?? id;
    await db.collection(MONGO_COLLECTIONS.storageLocations).updateOne(
      { _id: result.insertedId },
      {
        $set: {
          id,
          path: id,
          path_ids: [id],
          path_items: [{
            storage_location_id: id,
            name,
            abbreviation: insertPayload.abbreviation ?? name,
            storage_location_type_id: insertPayload.storage_location_type_id ?? null,
            storage_location_type_name: insertPayload.storage_location_type_name ?? null,
            icon_key: insertPayload.icon_key ?? null,
            color_key: insertPayload.color_key ?? null,
          }],
        },
      }
    );
    return { id, name };
  },

  async findMarketplaceAd(input: MarketplaceAdInput) {
    const found = await db.collection(MONGO_COLLECTIONS.mercadoLivreBrasilAnuncio)
      .findOne(buildMongoMarketplaceAdFilter(input));
    if (!found) return null;
    return { id: String(found._id), mlbId: asString(found.mlb_id ?? found.data?.id), raw: found };
  },

  async upsertMarketplaceAd(payload: Document) {
    const data = payload.data && typeof payload.data === 'object'
      ? payload.data as Document
      : {};
    const mlbId = asString(data.id ?? payload.mlb_id);
    if (!mlbId) {
      throw new Error('mlb_id ausente para upsert de anuncio Mongo.');
    }
    const now = new Date();
    const filter = buildMongoMarketplaceAdFilter({
      integrationId: String(payload.integration_id),
      mlbId,
    });
    const existing = await db.collection(MONGO_COLLECTIONS.mercadoLivreBrasilAnuncio).findOne(filter);
    const metadata = payload.metadata && typeof payload.metadata === 'object'
      ? { ...(payload.metadata as Record<string, unknown>), testCreated: !existing }
      : payload.metadata;
    const result = await db.collection(MONGO_COLLECTIONS.mercadoLivreBrasilAnuncio).findOneAndUpdate(
      filter,
      {
        $set: {
          ...payload,
          mlb_id: mlbId,
          data: { ...data, id: mlbId },
          metadata,
          updated_at: now,
        },
        $setOnInsert: { created_at: now },
      },
      { upsert: true, returnDocument: 'after' }
    );
    return {
      id: String(result?._id ?? ''),
      mlbId,
      raw: result ?? undefined,
    };
  },

  async findPartCategory(input) {
    const found = await db.collection(MONGO_COLLECTIONS.parte)
      .findOne({ MLB_categoria_id: input.categoryId });
    if (!found) return null;
    return { id: String(found._id), raw: found };
  },
});
