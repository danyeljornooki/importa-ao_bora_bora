import { MONGO_COLLECTIONS } from '../adapters/mongo/collectionNames';
import type { SchemaContract } from './types';

export const parteContract: SchemaContract = {
  logicalName: 'parte',
  mongoCollection: MONGO_COLLECTIONS.parte,
  supabaseTable: null,
  idMapping: {
    mongo: '_id',
    supabase: null,
    domain: 'id',
    adapterRule: 'Adapters convertem _id para id no dominio interno.',
  },
  fields: [
    '_id',
    'idInt',
    'nome',
    'MLB_categoria_id',
    'nome_abreviado',
    'posicao',
    'altura',
    'largura',
    'comprimento',
    'peso',
    'foto',
    'catalogo_attributes',
    'shopee_attributes',
    'shopee_category_id',
    'shopee_brand_id',
    'vehicle_type',
    'compatibilities_restrictions',
    'images',
    'image_count',
    'search_name_ngrams',
  ],
  indexes: [
    { name: 'MLB_categoria_id_1', key: { MLB_categoria_id: 1 } },
    { name: 'nome_1', key: { nome: 1 } },
    { name: 'idInt_1', key: { idInt: 1 } },
    { name: 'nome_abreviado_1', key: { nome_abreviado: 1 } },
  ],
};
