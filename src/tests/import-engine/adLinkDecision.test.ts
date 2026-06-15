import { describe, expect, it, vi } from 'vitest';
import {
  MarketplaceProxyError,
  type MarketplaceAdapter,
} from '../../adapters/mercado-livre/mercadoLivreAdapter';
import { executePartImportWithComplements } from '../../engine/executePartImportWithComplements';
import { resolveAdLink } from '../../core/marketplace/ad-link/resolveAdLink';
import type { ImportHistoryAdapter } from '../../types/importHistory.types';
import type { InventoryPersistenceAdapter } from '../../types/inventory.types';
import type {
  MarketplaceAd,
  MarketplaceAdRegistryAdapter,
} from '../../types/marketplaceAd.types';
import type { RunImportResult } from '../../engine/runImport';

const listing = (status: string) => ({
  id: 'MLB123',
  title: 'Peca',
  price: 10,
  availableQuantity: 1,
  status,
  categoryId: 'CAT',
  permalink: 'https://example.com/item',
  thumbnail: null,
  pictures: ['https://example.com/image.jpg'],
  sellerSku: 'P-1',
  catalogListing: false,
  listingType: null,
  raw: { attributes: [] },
});

const marketplaceAdapter = (
  loadListing: MarketplaceAdapter['loadListing']
): MarketplaceAdapter => ({
  scanListings: vi.fn(),
  loadListing,
  loadListingDescription: vi.fn().mockResolvedValue({
    plainText: 'Descricao',
    raw: {},
  }),
});

const registry = (
  records: MarketplaceAd[] = []
): MarketplaceAdRegistryAdapter => ({
  findByMlbId: vi.fn().mockResolvedValue(records),
  findExact: vi.fn().mockResolvedValue(null),
  insertAd: vi.fn(),
  updateAd: vi.fn(),
  markDuplicates: vi.fn(),
});

const analysisResult = (): RunImportResult => ({
  sheetName: 'Pecas',
  executionPlan: {
    summary: {
      executable: 1,
      creates: 1,
      updates: 0,
      skipped: 0,
      conflicts: 0,
      invalid: 0,
    },
    actions: [{
      row: 1,
      type: 'create',
      reason: 'nova peca',
      payload: {
        store_id: 'store-1',
        code: 'P-1',
        marketplace_name: 'Peca',
        stock_quantity: 1,
        status: 'DISPONIVEL',
        price: 10,
        marketplace_price: 10,
        images: [],
        image_count: 0,
        catalog_attributes: [],
        use_default_price: false,
      },
    }],
  },
  importPlan: {
    summary: {
      total: 1,
      creates: 1,
      updates: 0,
      unchangedUpdates: 0,
      conflicts: 0,
      skipped: 0,
      invalid: 0,
    },
    actions: [{
      row: 1,
      type: 'create',
      reason: 'nova peca',
      data: {
        code: 'P-1',
        title: 'Peca',
        price: 10,
        stock_quantity: 1,
        mlb_ids: ['MLB123'],
      },
    }],
  },
  summary: {
    totalRows: 1,
    valid: 1,
    invalid: 0,
    warnings: 0,
    creates: 1,
    updates: 0,
    unchangedUpdates: 0,
    conflicts: 0,
    skipped: 0,
    executable: 1,
  },
} as RunImportResult);

const historyAdapter = (): ImportHistoryAdapter => ({
  createRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
  saveRunItems: vi.fn().mockResolvedValue(undefined),
  completeRun: vi.fn().mockResolvedValue(undefined),
  failRun: vi.fn().mockResolvedValue(undefined),
  listRuns: vi.fn(),
  getRun: vi.fn(),
  getRunItems: vi.fn(),
  exportPending: vi.fn(),
});

const inventoryAdapter = (): InventoryPersistenceAdapter => ({
  loadStoreInventory: vi.fn(),
  createItem: vi.fn().mockResolvedValue({ success: true, id: 'part-1' }),
  updateItem: vi.fn(),
});

const executeWithMarketplace = async (
  adapter: MarketplaceAdapter,
  adRegistryAdapter = registry()
) => executePartImportWithComplements({
  analysisResult: analysisResult(),
  executionContext: {
    integrationId: 'integration-1',
    storeId: 'store-1',
    channel: 'mercado_livre_brasil',
  },
  inventoryAdapter: inventoryAdapter(),
  historyAdapter: historyAdapter(),
  adRegistryAdapter,
  marketplaceAdapter: adapter,
});

describe('AdLink decision', () => {
  it('mantem anuncio under_review como candidato valido', async () => {
    const decision = await resolveAdLink(
      {
        peca: { id: 'part-1', store_id: 'store-1', code: 'P-1' },
        context: {
          integrationId: 'integration-1',
          storeId: 'store-1',
          channel: 'mercado_livre_brasil',
        },
        mlbIds: ['MLB123'],
      },
      registry(),
      marketplaceAdapter(vi.fn().mockResolvedValue(listing('under_review')))
    );

    expect(decision.action).toBe('insert_new_ad');
    expect(decision.warnings.some((warning) =>
      warning.includes('under_review')
    )).toBe(true);
  });

  it.each([403, 404])(
    'HTTP %s vira pending sem bloquear a peca',
    async (status) => {
      const result = await executeWithMarketplace(
        marketplaceAdapter(vi.fn().mockRejectedValue(
          new MarketplaceProxyError('falha externa', status)
        ))
      );

      expect(result.persistResult.created).toBe(1);
      expect(result.rows[0].partResult.action).toBe('created');
      expect(result.rows[0].adLinkResult.action).toBe('pending');
    }
  );

  it('conflict de registry nao bloqueia a peca', async () => {
    const record: MarketplaceAd = {
      id: 'ad-1',
      storeId: 'store-1',
      integrationId: 'integration-1',
      pecaId: 'other-part',
      marketplace: 'mercado_livre_brasil',
      mlbId: 'MLB123',
      pictures: [],
      attributes: [],
      descriptionData: {},
      rawData: {},
      isDuplicate: false,
    };
    const result = await executeWithMarketplace(
      marketplaceAdapter(vi.fn().mockResolvedValue(listing('active'))),
      registry([record])
    );

    expect(result.persistResult.created).toBe(1);
    expect(result.rows[0].partResult.action).toBe('created');
    expect(result.rows[0].adLinkResult.action).toBe('conflict');
  });
});
