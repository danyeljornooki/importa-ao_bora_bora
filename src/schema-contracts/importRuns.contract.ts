import { MONGO_COLLECTIONS } from '../adapters/mongo/client/collectionNames';
import type { SchemaContract } from './types';

export const importRunsContract: SchemaContract = {
  logicalName: 'import_runs',
  mongoCollection: MONGO_COLLECTIONS.importRuns,
  supabaseTable: 'import_runs',
  idMapping: {
    mongo: '_id',
    supabase: 'id',
    domain: 'id',
    adapterRule: 'Supabase usa id; Mongo usa _id; adapters convertem _id <-> id.',
  },
  fields: ['_id', 'id', 'store_id', 'status', 'file_name', 'created_at', 'updated_at'],
  indexes: [
    { name: 'store_id_1_created_at_-1', key: { store_id: 1, created_at: -1 } },
    { name: 'status_1_created_at_-1', key: { status: 1, created_at: -1 } },
    { name: 'file_name_1', key: { file_name: 1 } },
    { name: 'created_at_-1', key: { created_at: -1 } },
  ],
};
