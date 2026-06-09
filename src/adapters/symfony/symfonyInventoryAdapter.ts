import type {
  InventoryPersistenceAdapter,
  InventoryPersistencePayload,
  PersistenceActionResult,
} from '../../types/inventory.types';

const notImplemented = (): PersistenceActionResult => ({
  success: false,
  error: 'Symfony inventory adapter ainda nao implementado',
});

export const symfonyInventoryAdapter: InventoryPersistenceAdapter = {
  async loadStoreInventory() {
    // TODO: implementar quando API Symfony estiver definida.
    throw new Error('Symfony inventory adapter ainda nao implementado');
  },

  async createItem(
    _payload: InventoryPersistencePayload
  ): Promise<PersistenceActionResult> {
    // TODO: implementar quando API Symfony estiver definida.
    return notImplemented();
  },

  async updateItem(
    _targetId: string,
    _payload: InventoryPersistencePayload
  ): Promise<PersistenceActionResult> {
    // TODO: implementar quando API Symfony estiver definida.
    return notImplemented();
  },
};
