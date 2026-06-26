import type {
  ExistingInventoryItem,
  InventoryPersistenceAdapter,
  PersistenceActionResult,
} from '../../types/inventory.types';

/**
 * Adapter de inventário Mongo para uso no CLIENTE (browser).
 *
 * O driver mongodb não roda no navegador, então a leitura passa por uma API route
 * server-side (/api/mongo/load-inventory). É isto que permite o dry-run/análise
 * rodar contra o Mongo de produção a partir da tela client-side.
 *
 * As ESCRITAS (create/update) NÃO acontecem aqui — a execução de produção
 * (peça + localização + anúncio + foto) roda server-side via API route própria
 * de execução. Aqui elas recusam de propósito.
 */
export const mongoInventoryClientAdapter: InventoryPersistenceAdapter = {
  async loadStoreInventory(storeId: string): Promise<ExistingInventoryItem[]> {
    const resp = await fetch('/api/mongo/load-inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error ?? `Erro ${resp.status} ao carregar inventário Mongo`);
    return (data.items ?? []) as ExistingInventoryItem[];
  },

  async createItem(): Promise<PersistenceActionResult> {
    return { success: false, error: 'Escrita Mongo é feita server-side (rota de execução), não pelo cliente' };
  },

  async updateItem(): Promise<PersistenceActionResult> {
    return { success: false, error: 'Escrita Mongo é feita server-side (rota de execução), não pelo cliente' };
  },
};

export default mongoInventoryClientAdapter;
