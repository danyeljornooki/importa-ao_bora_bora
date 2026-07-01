import type { MongoCollectionName } from '../adapters/mongo/client/collectionNames';

export type MongoIndexDirection = 1 | -1;

export interface SchemaIndexContract {
  name: string;
  key: Record<string, MongoIndexDirection>;
}

export interface SchemaContract {
  logicalName: string;
  mongoCollection: MongoCollectionName;
  supabaseTable: string | null;
  idMapping: {
    mongo: '_id';
    supabase: 'id' | null;
    domain: 'id';
    adapterRule: string;
  };
  fields: string[];
  indexes: SchemaIndexContract[];
}
