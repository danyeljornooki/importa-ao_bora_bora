import { describe, expect, it, vi } from 'vitest';
import {
  executeOfficialImportWithTarget,
  resolveOfficialImportTargetName,
  shouldShowImportTargetSwitch,
} from '../../engine/import-targets/officialImportWithTarget';
import type { ImportExecutionContext } from '../../types/integration.types';
import type { InventoryPersistenceAdapter } from '../../types/inventory.types';
import type { ImportWriteTarget } from '../../engine/import-targets/types';

const context: ImportExecutionContext = {
  integrationId: 'integration-1',
  storeId: 'store-1',
  channel: 'mercado_livre_brasil',
};

const csv = (rows: string): ArrayBuffer => {
  const buffer = Buffer.from(rows, 'utf8');
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
};

const inventoryAdapter = (items: any[] = []): InventoryPersistenceAdapter => ({
  loadStoreInventory: vi.fn(async () => items),
  createItem: vi.fn(async () => ({ success: true, id: 'supabase-created' })),
  updateItem: vi.fn(async (_id: string) => ({ success: true, id: _id })),
});

const historyAdapter = () => ({
  createRun: vi.fn(async () => ({ id: 'run-supabase' })),
  saveRunItems: vi.fn(async () => undefined),
  completeRun: vi.fn(async () => undefined),
  failRun: vi.fn(async () => undefined),
  listRuns: vi.fn(),
  getRun: vi.fn(),
  getRunItems: vi.fn(),
  exportPending: vi.fn(),
});

const supabaseDeps = (adapter = inventoryAdapter()) => ({
  inventoryAdapter: adapter,
  storageLocationAdapter: null,
  historyAdapter: historyAdapter(),
  adRegistryAdapter: {} as any,
  marketplaceAdapter: {} as any,
});

const mongoTarget = (): ImportWriteTarget => ({
  name: 'mongo',
  createImportRun: vi.fn(async () => ({ id: 'run-mongo' })),
  updateImportRun: vi.fn(async () => undefined),
  createImportRunItem: vi.fn(async () => ({ id: 'item-1' })),
  findInventoryItem: vi.fn(async () => null),
  createInventoryItem: vi.fn(async () => ({ id: 'inventory-1' })),
  updateInventoryItem: vi.fn(async (id: string) => ({ id })),
  findStorageLocation: vi.fn(async () => null),
  createStorageLocation: vi.fn(async () => ({ id: 'location-1', name: 'A1' })),
  findMarketplaceAd: vi.fn(async () => null),
  upsertMarketplaceAd: vi.fn(async () => ({ id: 'ad-1', mlbId: 'MLB1' })),
  findPartCategory: vi.fn(async () => null),
});

const file = csv('code,title,price,stock_quantity,location,mlb_ids\nP1,Teste,10,1,A1,MLB1\n');

describe('official import target wiring', () => {
  it('uses Supabase as default when no target is provided', () => {
    expect(resolveOfficialImportTargetName()).toBe('supabase');
  });

  it('falls back to Supabase for invalid target env values', () => {
    const previous = process.env.IMPORT_TARGET_DEFAULT;
    process.env.IMPORT_TARGET_DEFAULT = 'invalid';
    expect(resolveOfficialImportTargetName()).toBe('supabase');
    process.env.IMPORT_TARGET_DEFAULT = previous;
  });

  it('runs dryRun on Supabase without write methods', async () => {
    const adapter = inventoryAdapter();
    const result = await executeOfficialImportWithTarget({
      fileBuffer: file,
      fileName: 'parts.csv',
      executionContext: context,
      mode: 'dryRun',
      supabase: supabaseDeps(adapter),
    });

    expect(result.target).toBe('supabase');
    expect(result.mode).toBe('dryRun');
    expect(result.wroteDocuments).toBe(false);
    expect(adapter.createItem).not.toHaveBeenCalled();
    expect(adapter.updateItem).not.toHaveBeenCalled();
  });

  it('blocks Mongo write when target was not explicit', async () => {
    const previous = process.env.IMPORT_TARGET_DEFAULT;
    process.env.IMPORT_TARGET_DEFAULT = 'mongo';

    await expect(executeOfficialImportWithTarget({
      fileBuffer: file,
      fileName: 'parts.csv',
      executionContext: context,
      mode: 'write',
      mongo: {
        target: mongoTarget(),
        inventoryAdapter: inventoryAdapter(),
      },
    })).rejects.toThrow('target=mongo explicitamente');

    process.env.IMPORT_TARGET_DEFAULT = previous;
  });

  it('blocks Mongo write without allowCategoryPending when parte has zero coverage', async () => {
    await expect(executeOfficialImportWithTarget({
      fileBuffer: file,
      fileName: 'parts.csv',
      executionContext: context,
      target: 'mongo',
      mode: 'write',
      mongo: {
        target: mongoTarget(),
        inventoryAdapter: inventoryAdapter(),
        fetchMarketplaceItem: async () => ({
          status: 'found',
          data: { id: 'MLB1', category_id: 'MLB-CAT-1' },
        }),
      },
    })).rejects.toThrow('Write bloqueado: collection parte sem cobertura suficiente.');
  });

  it('allows Mongo write with allowCategoryPending and writes through target', async () => {
    const target = mongoTarget();
    const result = await executeOfficialImportWithTarget({
      fileBuffer: file,
      fileName: 'parts.csv',
      executionContext: context,
      target: 'mongo',
      mode: 'write',
      allowCategoryPending: true,
      testRunId: 'test-run-1',
      mongo: {
        target,
        inventoryAdapter: inventoryAdapter(),
        fetchMarketplaceItem: async () => ({
          status: 'found',
          data: { id: 'MLB1', category_id: 'MLB-CAT-1' },
        }),
      },
    });

    expect(result.target).toBe('mongo');
    expect(result.wroteDocuments).toBe(true);
    expect(result.write?.inventoryCreated).toBe(1);
    expect(target.createImportRun).toHaveBeenCalled();
    expect(target.createInventoryItem).toHaveBeenCalled();
    expect(target.createImportRunItem).toHaveBeenCalled();
  });

  it('does not show Mongo target switch without dev flag', () => {
    const previousDev = process.env.NEXT_PUBLIC_SHOW_DEV_LINKS;
    const previousSwitch = process.env.NEXT_PUBLIC_ENABLE_IMPORT_TARGET_SWITCH;
    delete process.env.NEXT_PUBLIC_SHOW_DEV_LINKS;
    delete process.env.NEXT_PUBLIC_ENABLE_IMPORT_TARGET_SWITCH;

    expect(shouldShowImportTargetSwitch()).toBe(false);

    process.env.NEXT_PUBLIC_SHOW_DEV_LINKS = previousDev;
    process.env.NEXT_PUBLIC_ENABLE_IMPORT_TARGET_SWITCH = previousSwitch;
  });
});

