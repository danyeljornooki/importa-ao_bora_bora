import { describe, expect, it } from 'vitest';
import { buildStorageLocationPayload } from '../../core/locations/buildStorageLocationPayload';

describe('buildStorageLocationPayload', () => {
  it('cria payload com path completo para localizacao hierarquica', () => {
    const payload = buildStorageLocationPayload(
      {
        storeId: 'store-1',
        rawLocation: 'SETOR B > CAIXA 246',
        createdBy: null,
      }
    );

    expect(payload).toMatchObject({
      store_id: 'store-1',
      name: 'CAIXA 246',
      description: '',
      status: 'active',
      created_by: 'store-1',
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
    expect(payload).not.toHaveProperty('created_at');
    expect(payload).not.toHaveProperty('updated_at');
    expect(payload).not.toHaveProperty('path');
    expect(payload).not.toHaveProperty('path_ids');
    expect(payload).not.toHaveProperty('path_items');
  });

  it('retorna null sem storeId ou localizacao util', () => {
    expect(buildStorageLocationPayload({ storeId: '', rawLocation: 'A1' })).toBeNull();
    expect(buildStorageLocationPayload({ storeId: 'store-1', rawLocation: '   ' })).toBeNull();
  });
});
