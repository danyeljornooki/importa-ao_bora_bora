import { MONGO_COLLECTIONS } from '../adapters/mongo/client/collectionNames';
import type { SchemaContract } from './types';

export const importRunItemsContract: SchemaContract = {
  logicalName: 'import_run_items',
  mongoCollection: MONGO_COLLECTIONS.importRunItems,
  supabaseTable: 'import_run_items',
  idMapping: {
    mongo: '_id',
    supabase: 'id',
    domain: 'id',
    adapterRule: 'Supabase usa id; Mongo usa _id; adapters convertem _id <-> id.',
  },
  fields: ['_id', 'id', 'run_id', 'row', 'status', 'type', 'store_id', 'peca_id', 'mlb_id', 'created_at'],
  indexes: [
    { name: 'run_id_1_row_1', key: { run_id: 1, row: 1 } },
    { name: 'run_id_1_status_1', key: { run_id: 1, status: 1 } },
    { name: 'run_id_1_type_1', key: { run_id: 1, type: 1 } },
    { name: 'store_id_1_created_at_-1', key: { store_id: 1, created_at: -1 } },
    { name: 'peca_id_1', key: { peca_id: 1 } },
    { name: 'mlb_id_1', key: { mlb_id: 1 } },
  ],
};
