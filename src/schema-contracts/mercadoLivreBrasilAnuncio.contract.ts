import { MONGO_COLLECTIONS } from '../adapters/mongo/collectionNames';
import type { SchemaContract } from './types';

export const mercadoLivreBrasilAnuncioContract: SchemaContract = {
  logicalName: 'mercado_livre_brasil_anuncio',
  mongoCollection: MONGO_COLLECTIONS.mercadoLivreBrasilAnuncio,
  supabaseTable: 'marketplace_ads',
  idMapping: {
    mongo: '_id',
    supabase: 'id',
    domain: 'id',
    adapterRule: 'Mongo usa _id; Supabase pode manter marketplace_ads ate migracao futura.',
  },
  fields: [
    '_id',
    'integration_id',
    'peca_id',
    'loja_id',
    'mlb_id',
    'data',
    'data.id',
    'data.title',
    'data.category_id',
    'data.price',
    'data.available_quantity',
    'data.status',
    'data.permalink',
    'data.pictures',
    'data.attributes',
    'data.thumbnail',
    'data.date_created',
    'data.last_updated',
  ],
  indexes: [
    { name: 'integration_id_1_mlb_id_1', key: { integration_id: 1, mlb_id: 1 } },
    { name: 'integration_id_1_data_id_1', key: { integration_id: 1, 'data.id': 1 } },
    { name: 'loja_id_1_peca_id_1', key: { loja_id: 1, peca_id: 1 } },
    { name: 'loja_id_1_integration_id_1', key: { loja_id: 1, integration_id: 1 } },
    { name: 'loja_id_1_data_status_1', key: { loja_id: 1, 'data.status': 1 } },
    { name: 'loja_id_1_data_last_updated_-1', key: { loja_id: 1, 'data.last_updated': -1 } },
    { name: 'peca_id_1', key: { peca_id: 1 } },
  ],
};
