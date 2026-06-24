import { describe, expect, it } from 'vitest';
import { buildStorageLocationPayload } from '../../core/locations/buildStorageLocationPayload';

describe('buildStorageLocationPayload', () => {
  it('cria payload com path completo para localizacao hierarquica', () => {
    const payload = buildStorageLocationPayload(
      {
        storeId: 'store-1',
        rawLocation: 'SETOR B > CAIXA 246',
        createdBy: null,
      },
      new Date('2026-01-02T03:04:05.000Z')
    );

    expect(payload).toMatchObject({
      store_id: 'store-1',
      name: 'CAIXA 246',
      description: '',
      status: 'active',
      created_by: 'store-1',
      created_at: '2026-01-02T03:04:05.000Z',
      location_path_names: ['SETOR B', 'CAIXA 246'],
      location_path_slugs: ['setor-b', 'caixa-246'],
      location_path_key: 'setor-b/caixa-246',
      location_path_prefixes: ['setor-b', 'setor-b/caixa-246'],
      location_path_text: 'SETOR B > CAIXA 246',
      path_text: 'SETOR B > CAIXA 246',
      location_path_depth: 2,
      level: 1,
      stock_capacity: 0,
      vehicle_brand_ids: [],
      part_category_ids: [],
      rule_overrides: [],
    });
    expect(payload?.path_items?.[0]).toMatchObject({
      name: 'CAIXA 246',
      storage_location_type_name: 'CAIXA',
    });
  });

  it('retorna null sem storeId ou localizacao util', () => {
    expect(buildStorageLocationPayload({ storeId: '', rawLocation: 'A1' })).toBeNull();
    expect(buildStorageLocationPayload({ storeId: 'store-1', rawLocation: '   ' })).toBeNull();
  });
});
