import { describe, expect, it, vi } from 'vitest';
import { resolveEnrichmentForComparison } from '../../engine/import-targets/compare/resolveEnrichmentForComparison';
import { compareEnrichmentSnapshots } from '../../engine/import-targets/compare/compareEnrichmentSnapshots';
import { getComparisonExitCode } from '../../engine/import-targets/compare/compareImportTargetPlans';
import type { ComparableImportRow, EnrichmentComparisonSnapshot } from '../../engine/import-targets/compare/types';

const row = (overrides: Partial<ComparableImportRow> = {}): ComparableImportRow => ({
  row: 1,
  code: 'ABC',
  id_int: 123,
  id_string: null,
  mlb_ids: ['MLB1'],
  action: 'create',
  payload: {
    code: 'ABC',
    id_int: 123,
    images: ['https://img.test/a.jpg'],
  },
  warnings: [],
  ...overrides,
});

const target = (found = true) => ({
  async findPartCategory() {
    return found
      ? { id: 'parte-1', raw: { _id: 'parte-1', nome: 'Farol', MLB_categoria_id: 'MLB-CAT', catalogo_attributes: [{ id: 'BRAND' }], embalagemAltura: 10 } }
      : null;
  },
});

describe('resolveEnrichmentForComparison', () => {
  it('builds a basic enrichment snapshot', async () => {
    const snapshot = await resolveEnrichmentForComparison({
      row: row(),
      integrationId: 'int-1',
      storeId: 'store-1',
      targetName: 'mongo',
      target: target(),
      allowExternalReads: true,
      fetchAd: async () => ({
        status: 'found',
        data: { id: 'MLB1', title: 'Titulo', price: 10, category_id: 'MLB-CAT', pictures: [{ url: 'x' }], attributes: [{ id: 'A' }] },
      }),
    });

    expect(snapshot.ads[0]).toMatchObject({ found: true, mlbId: 'MLB1', categoryId: 'MLB-CAT' });
    expect(snapshot.category.partCategoryFound).toBe(true);
    expect(snapshot.catalog.attributes).toEqual([{ id: 'BRAND' }]);
  });

  it('maps 403/no access to ad_no_access warning', async () => {
    const snapshot = await resolveEnrichmentForComparison({
      row: row(),
      integrationId: 'int-1',
      storeId: 'store-1',
      targetName: 'mongo',
      target: target(false),
      allowExternalReads: true,
      fetchAd: async () => ({ status: 'no_access' }),
    });
    expect(snapshot.warnings).toContain('ad_no_access:MLB1');
  });

  it('maps 404 to ad_not_found warning', async () => {
    const snapshot = await resolveEnrichmentForComparison({
      row: row(),
      integrationId: 'int-1',
      storeId: 'store-1',
      targetName: 'mongo',
      target: target(false),
      allowExternalReads: true,
      fetchAd: async () => ({ status: 'not_found' }),
    });
    expect(snapshot.warnings).toContain('ad_not_found:MLB1');
  });

  it('can reuse a cached fetcher for duplicated MLBs', async () => {
    const fetchAd = vi.fn(async (_mlbId: string) => ({ status: 'not_found' as const }));
    const cache = new Map<string, Promise<any>>();
    const cachedFetch = (mlbId: string) => {
      if (!cache.has(mlbId)) cache.set(mlbId, fetchAd(mlbId));
      return cache.get(mlbId)!;
    };

    await resolveEnrichmentForComparison({ row: row(), integrationId: 'i', storeId: 's', targetName: 'mongo', target: target(false), allowExternalReads: true, fetchAd: cachedFetch });
    await resolveEnrichmentForComparison({ row: row({ row: 2 }), integrationId: 'i', storeId: 's', targetName: 'mongo', target: target(false), allowExternalReads: true, fetchAd: cachedFetch });
    expect(fetchAd).toHaveBeenCalledTimes(1);
  });
});

const snapshot = (overrides: Partial<EnrichmentComparisonSnapshot> = {}): EnrichmentComparisonSnapshot => ({
  targetName: 'supabase',
  row: 1,
  code: 'ABC',
  id_int: 123,
  id_string: null,
  mlb_ids: ['MLB1'],
  category: {
    sourceCategoryId: 'MLB-CAT',
    mlCategoryId: 'MLB-CAT',
    finalCategoryId: 'MLB-CAT',
    partCategoryFound: true,
    partCategoryId: 'parte-1',
    partCategoryName: 'Farol',
    mercadoLibreBrasilCategoryId: 'MLB-CAT',
    pendingReason: null,
  },
  catalog: { attributes: [{ id: 'A' }], missingRequiredAttributes: [], source: 'parte' },
  package: { height: 10, width: 20, length: 30, weight: 1, source: 'parte' },
  ads: [{ mlbId: 'MLB1', status: 'found', found: true, noAccess: false, notFound: false, title: 'T', price: 10, availableQuantity: 1, categoryId: 'MLB-CAT', permalink: null, pictureCount: 1, attributeCount: 1, thumbnail: null, dateCreated: null, lastUpdated: null }],
  images: { source: 'sheet', urls: ['a'], count: 1 },
  warnings: [],
  ...overrides,
});

describe('compareEnrichmentSnapshots', () => {
  it('detects different final category as critical when both have reference', () => {
    const result = compareEnrichmentSnapshots(
      [snapshot()],
      [snapshot({ targetName: 'mongo', category: { ...snapshot().category, finalCategoryId: 'OTHER', partCategoryName: 'Outro' } })]
    );
    expect(result.summary.critical).toBeGreaterThan(0);
  });

  it('classifies missing Mongo parte as expected', () => {
    const result = compareEnrichmentSnapshots(
      [snapshot()],
      [snapshot({ targetName: 'mongo', category: { ...snapshot().category, partCategoryFound: false, partCategoryName: null, pendingReason: 'category_pending' }, warnings: ['category_pending:MLB-CAT'] })]
    );
    expect(result.summary.expected).toBeGreaterThan(0);
  });

  it('classifies image differences as warning', () => {
    const result = compareEnrichmentSnapshots(
      [snapshot()],
      [snapshot({ targetName: 'mongo', images: { source: 'sheet', urls: ['b'], count: 1 } })]
    );
    expect(result.summary.warning).toBeGreaterThan(0);
  });

  it('classifies package differences as warning', () => {
    const result = compareEnrichmentSnapshots(
      [snapshot()],
      [snapshot({ targetName: 'mongo', package: { height: 99, width: 20, length: 30, weight: 1, source: 'parte' } })]
    );
    expect(result.summary.warning).toBeGreaterThan(0);
  });

  it('critical enrichment makes exit code 1', () => {
    const report = { summary: { totalRows: 1, equal: 0, critical: 0, warning: 0, expected: 0, info: 0, enrichment: { equal: 0, critical: 1, warning: 0, expected: 0, info: 0, categoryEqual: 0, categoryPending: 0, categoryDivergent: 1, adFound: 0, adNoAccess: 0, adNotFound: 0, imageEqual: 0, imageDiffs: 0, warnings: 0 } }, rows: [] };
    expect(getComparisonExitCode(report as any)).toBe(1);
  });
});
