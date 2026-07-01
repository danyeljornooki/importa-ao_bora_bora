import { MONGO_COLLECTIONS } from '../adapters/mongo/client/collectionNames';
import type { SchemaContract } from './types';

export const mongoImportUpdateSnapshotsContract: SchemaContract = {
  logicalName: 'mongo_import_update_snapshots',
  mongoCollection: MONGO_COLLECTIONS.mongoImportUpdateSnapshots,
  supabaseTable: null,
  idMapping: {
    mongo: '_id',
    supabase: null,
    domain: 'id',
    adapterRule: 'Collection exclusiva do Mongo para rollback de updates controlados.',
  },
  fields: [
    '_id',
    'testRunId',
    'runId',
    'source',
    'collection',
    'documentId',
    'store_id',
    'integration_id',
    'file_name',
    'operation',
    'filter',
    'before',
    'patch',
    'after',
    'created_at',
    'rolled_back',
    'rolled_back_at',
    'rollback_error',
    'metadata',
  ],
  indexes: [
    { name: 'testRunId_1_created_at_-1', key: { testRunId: 1, created_at: -1 } },
    { name: 'runId_1_created_at_-1', key: { runId: 1, created_at: -1 } },
    { name: 'collection_1_documentId_1', key: { collection: 1, documentId: 1 } },
    { name: 'store_id_1_created_at_-1', key: { store_id: 1, created_at: -1 } },
    { name: 'rolled_back_1', key: { rolled_back: 1 } },
  ],
};

