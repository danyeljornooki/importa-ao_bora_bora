import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../adapters/supabase/supabaseClient', () => ({
  supabase: {},
}));

import { createSupabaseStorageLocationAdapter } from '../../adapters/supabase/supabaseStorageLocationAdapter';
import { buildStorageLocationPayload } from '../../core/locations/buildStorageLocationPayload';
import { buildExecutionPlanWithLocations } from '../../planners/buildExecutionPlan';
import type { PartCanonical } from '../../modules/importer/schemas/part.schema';

const insertedRow = {
  id: 'location-123',
  store_id: 'store-1',
  name: 'CAIXA 246',
  abbreviation: 'CAIXA-246',
  storage_location_type_id: null,
  storage_location_type_name: null,
  icon_key: null,
  color_key: null,
  path_text: 'SETOR B > CAIXA 246',
  location_path_text: 'SETOR B > CAIXA 246',
  location_path_key: 'setor-b/caixa-246',
  location_path_names: ['SETOR B', 'CAIXA 246'],
  location_path_slugs: ['setor-b', 'caixa-246'],
  path_ids: [],
  path_items: [],
  status: 'active',
};

const createClient = () => {
  let insertPayload: Record<string, unknown> | null = null;
  let updatePayload: Record<string, unknown> | null = null;

  const client = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          neq: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
      insert: vi.fn((payload: Record<string, unknown>) => {
        insertPayload = payload;
        return {
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: insertedRow, error: null }),
          })),
        };
      }),
      update: vi.fn((payload: Record<string, unknown>) => {
        updatePayload = payload;
        return {
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  ...insertedRow,
                  ...payload,
                },
                error: null,
              }),
            })),
          })),
        };
      }),
    })),
  } as unknown as SupabaseClient;

  return {
    client,
    getInsertPayload: () => insertPayload,
    getUpdatePayload: () => updatePayload,
  };
};

const part = (): PartCanonical => ({
  code: 'P-1',
  title: 'Peca',
  price: 10,
  stock_quantity: 1,
  location: 'SETOR B > CAIXA 246',
});

describe('supabaseStorageLocationAdapter createLocation', () => {
  it('finaliza os campos autorreferenciais depois de receber o id', async () => {
    const fake = createClient();
    const adapter = createSupabaseStorageLocationAdapter(fake.client);
    const payload = buildStorageLocationPayload({
      storeId: 'store-1',
      rawLocation: 'SETOR B > CAIXA 246',
    });

    expect(payload).not.toBeNull();
    const created = await adapter.createLocation(payload!);

    expect(fake.getInsertPayload()).not.toHaveProperty('path');
    expect(fake.getInsertPayload()).not.toHaveProperty('path_ids');
    expect(fake.getInsertPayload()).not.toHaveProperty('path_items');
    expect(fake.getInsertPayload()).not.toHaveProperty('created_at');
    expect(fake.getInsertPayload()).not.toHaveProperty('updated_at');
    expect(fake.getUpdatePayload()).toEqual({
      path: 'location-123',
      path_ids: ['location-123'],
      path_items: [{
        storage_location_id: 'location-123',
        name: 'CAIXA 246',
        abbreviation: 'CAIXA-246',
        storage_location_type_id: null,
        storage_location_type_name: 'CAIXA',
        icon_key: null,
        color_key: null,
      }],
    });
    expect(created.path_ids).toEqual(['location-123']);
    expect(created.path_items?.[0].storage_location_id).toBe('location-123');
  });

  it('mantem o nome da localizacao vinculado na peca', async () => {
    const fake = createClient();
    const plan = await buildExecutionPlanWithLocations(
      [{ row: 1, valid: true, action: 'create', data: part() }],
      {
        storeId: 'store-1',
        storageLocationAdapter: createSupabaseStorageLocationAdapter(fake.client),
      }
    );

    expect(plan.actions[0].payload).toMatchObject({
      storage_location_id: 'location-123',
      storage_location_name: 'SETOR B > CAIXA 246',
      storage_location_source: 'linked',
    });
  });
});
