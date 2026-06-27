export const MONGO_COLLECTIONS = {
  parte: 'parte',
  storageLocations: 'storage_locations',
  inventoryItems: 'inventory_items',
  mercadoLivreBrasilAnuncio: 'mercado_livre_brasil_anuncio',
  importRuns: 'import_runs',
  importRunItems: 'import_run_items',
} as const;

export type MongoCollectionName =
  (typeof MONGO_COLLECTIONS)[keyof typeof MONGO_COLLECTIONS];
