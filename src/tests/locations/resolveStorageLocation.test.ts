import { describe, expect, it } from 'vitest';
import { buildExecutionPlanWithLocations } from '../../planners/buildExecutionPlan';
import { resolveStorageLocation } from '../../core/locations/resolveStorageLocation';
import type { StorageLocation } from '../../core/locations/location.types';
import type { StorageLocationAdapter } from '../../core/locations/storageLocationAdapter';
import type { PartCanonical } from '../../modules/importer/schemas/part.schema';

const location = (overrides: Partial<StorageLocation>): StorageLocation => ({
  _id: 'loc-1',
  store_id: 'store-1',
  name: 'PRATELEIRA A',
  location_path_key: 'prateleira-a',
  location_path_text: 'PRATELEIRA A',
  path_text: 'PRATELEIRA A',
  status: 'active',
  ...overrides,
});

const adapter = (
  locations: StorageLocation[],
  create: StorageLocation = location({ _id: 'created-loc' })
): StorageLocationAdapter => ({
  findCandidates: async () => locations,
  createLocation: async () => create,
});

const part = (locationName: string): PartCanonical => ({
  code: 'P-1',
  title: 'Peca',
  price: 10,
  stock_quantity: 1,
  location: locationName,
});

describe('resolveStorageLocation', () => {
  it('encontra por location_path_key', async () => {
    const result = await resolveStorageLocation(
      { storeId: 'store-1', rawLocation: 'PRATELEIRA A' },
      adapter([location({ _id: 'loc-key' })])
    );

    expect(result).toMatchObject({
      found: true,
      created: false,
      source: 'linked',
      location: { _id: 'loc-key' },
    });
  });

  it('encontra por name case-insensitive', async () => {
    const result = await resolveStorageLocation(
      { storeId: 'store-1', rawLocation: 'prateleira a' },
      adapter([location({ _id: 'loc-name', location_path_key: null })])
    );

    expect(result?.location._id).toBe('loc-name');
  });

  it('cria quando nao encontra localizacao', async () => {
    const created = location({
      _id: 'created-loc',
      name: 'CAIXA 246',
      location_path_key: 'setor-b/caixa-246',
      location_path_text: 'SETOR B > CAIXA 246',
    });
    const result = await resolveStorageLocation(
      { storeId: 'store-1', rawLocation: 'SETOR B > CAIXA 246' },
      adapter([], created)
    );

    expect(result).toMatchObject({
      found: false,
      created: true,
      location: { _id: 'created-loc' },
    });
  });

  it('nao vincula aleatoriamente quando ha ambiguidade', async () => {
    const result = await resolveStorageLocation(
      { storeId: 'store-1', rawLocation: 'PRATELEIRA A' },
      adapter([
        location({ _id: 'loc-1', status: 'active', location_path_text: 'OUTRO > PRATELEIRA A' }),
        location({ _id: 'loc-2', status: 'active', location_path_text: 'MAIS UM > PRATELEIRA A' }),
      ])
    );

    expect(result).toBeNull();
  });

  it('peca com localizacao gera storage_location_id e storage_location_name', async () => {
    const plan = await buildExecutionPlanWithLocations(
      [{ row: 1, valid: true, action: 'create', data: part('PRATELEIRA A') }],
      {
        storeId: 'store-1',
        storageLocationAdapter: adapter([location({ _id: 'loc-1' })]),
      }
    );

    expect(plan.actions[0].payload).toMatchObject({
      storage_location_id: 'loc-1',
      storage_location_name: 'PRATELEIRA A',
      storage_location_source: 'linked',
    });
  });

  it('falha de localizacao gera warning sem bloquear peca', async () => {
    const failingAdapter: StorageLocationAdapter = {
      findCandidates: async () => {
        throw new Error('storage indisponivel');
      },
      createLocation: async () => {
        throw new Error('nao deveria criar');
      },
    };
    const plan = await buildExecutionPlanWithLocations(
      [{ row: 1, valid: true, action: 'create', data: part('PRATELEIRA A') }],
      { storeId: 'store-1', storageLocationAdapter: failingAdapter }
    );

    expect(plan.actions[0]).toMatchObject({
      type: 'create',
      warnings: ['location_pending'],
    });
    expect(plan.actions[0].payload).toMatchObject({
      storage_location_name: 'PRATELEIRA A',
    });
    expect(plan.actions[0].payload).not.toHaveProperty('storage_location_id');
  });
});
