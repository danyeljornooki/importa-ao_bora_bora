import type {
  InventoryPersistenceAdapter,
  InventoryPersistencePayload,
  PersistenceActionResult,
} from '../../types/inventory.types';

const notImplemented = (): PersistenceActionResult => ({
  success: false,
  error: 'Mongo inventory adapter ainda nao implementado',
});

export const mongoInventoryAdapter: InventoryPersistenceAdapter = {
  async loadStoreInventory() {
    // TODO: implementar conexao e consulta Mongo.
    throw new Error('Mongo inventory adapter ainda nao implementado');
  },

  async createItem(
    _payload: InventoryPersistencePayload
  ): Promise<PersistenceActionResult> {
    // TODO: implementar insert Mongo.
    return notImplemented();
  },

  async updateItem(
    _targetId: string,
    _payload: InventoryPersistencePayload
  ): Promise<PersistenceActionResult> {
    // TODO: implementar update Mongo por _id.
    return notImplemented();
  },
};
