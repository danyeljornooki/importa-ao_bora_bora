import { describe, expect, it, vi } from 'vitest';
import {
  finalizeExecutionPlanLocations,
  LOCATION_PENDING_MESSAGE,
} from '../../core/locations/finalizeExecutionPlanLocations';
import type { StorageLocationAdapter } from '../../core/locations/storageLocationAdapter';
import type { PartCanonical } from '../../modules/importer/schemas/part.schema';
import type { ExecutionPlan } from '../../planners/buildExecutionPlan';

const storeId = '685d9fdc783a823d338b45ba';

const plan = (
  type: 'create' | 'update',
  payload: Record<string, unknown> = {}
): ExecutionPlan => ({
  summary: {
    executable: 1,
    creates: type === 'create' ? 1 : 0,
    updates: type === 'update' ? 1 : 0,
    skipped: 0,
    conflicts: 0,
    invalid: 0,
  },
  actions: [{
    row: 1,
    type,
    reason: type === 'create' ? 'nova peca' : 'peca atualizada',
    targetId: type === 'update' ? 'part-1' : undefined,
    payload: payload as never,
  }],
});

const part = (overrides: Record<string, unknown> = {}): PartCanonical => ({
  code: '7571302',
  title: 'Teste Localização',
  stock_quantity: 1,
  price: 10,
  ...overrides,
});

const adapter = (
  options: { fail?: boolean; existing?: boolean } = {}
): StorageLocationAdapter => ({
  findCandidates: vi.fn(async () => {
    if (options.fail) throw new Error('storage indisponivel');
    return options.existing
      ? [{
          id: 'location-existing',
          _id: 'location-existing',
          store_id: storeId,
          name: 'PRATELEIRA_NOVA',
          path_text: 'PRATELEIRA_NOVA',
          status: 'active',
        }]
      : [];
  }),
  createLocation: vi.fn(async (payload) => ({
    id: 'location-created',
    _id: 'location-created',
    store_id: payload.store_id,
    name: payload.name,
    path_text: payload.path_text,
    status: 'active',
  })),
});

const finalize = (
  executionPlan: ExecutionPlan,
  importedPart: PartCanonical,
  storageLocationAdapter: StorageLocationAdapter | null
) => finalizeExecutionPlanLocations(
  executionPlan,
  new Map([[1, importedPart]]),
  { storeId, storageLocationAdapter }
);

describe('finalizeExecutionPlanLocations', () => {
  it('create com location cria e vincula storage_location', async () => {
    const storage = adapter();
    const result = await finalize(
      plan('create'),
      part({ location: 'PRATELEIRA12' }),
      storage
    );

    expect(storage.createLocation).toHaveBeenCalledOnce();
    expect(result.actions[0].payload).toMatchObject({
      storage_location_id: 'location-created',
      storage_location_name: 'PRATELEIRA12',
      storage_location_source: 'linked',
    });
  });

  it('create com storage_location_name cria e vincula storage_location', async () => {
    const storage = adapter();
    const result = await finalize(
      plan('create'),
      part({ storage_location_name: 'PRATELEIRA_TESTE_01' }),
      storage
    );

    expect(storage.createLocation).toHaveBeenCalledOnce();
    expect(result.actions[0].payload).toMatchObject({
      storage_location_id: 'location-created',
      storage_location_name: 'PRATELEIRA_TESTE_01',
      storage_location_source: 'linked',
    });
  });

  it('update com location diferente atualiza o vinculo', async () => {
    const result = await finalize(
      plan('update', {
        storage_location_id: 'location-old',
        storage_location_name: 'PRATELEIRA_ANTIGA',
      }),
      part({ location: 'PRATELEIRA_NOVA' }),
      adapter({ existing: true })
    );

    expect(result.actions[0].payload).toMatchObject({
      storage_location_id: 'location-existing',
      storage_location_name: 'PRATELEIRA_NOVA',
      storage_location_source: 'linked',
    });
  });

  it('peca sem location nao limpa a localizacao existente', async () => {
    const original = {
      price: 10,
      storage_location_id: 'location-old',
      storage_location_name: 'PRATELEIRA_ANTIGA',
      storage_location_source: 'linked',
    };
    const result = await finalize(plan('update', original), part(), adapter());

    expect(result.actions[0].payload).toEqual(original);
  });

  it('falha no resolver gera pending e warning sem bloquear a peca', async () => {
    const result = await finalize(
      plan('create'),
      part({ location: 'PRATELEIRA12' }),
      adapter({ fail: true })
    );

    expect(result.actions[0].payload).toMatchObject({
      storage_location_id: null,
      storage_location_name: 'PRATELEIRA12',
      storage_location_source: 'pending',
    });
    expect(result.actions[0].warnings).toContain(
      `location_pending: ${LOCATION_PENDING_MESSAGE}`
    );
  });

  it('nunca deixa storage_location_source vazio quando veio localizacao', async () => {
    const linked = await finalize(
      plan('create'),
      part({ raw: { localizacao: 'A1' } }),
      adapter()
    );
    const pending = await finalize(
      plan('create'),
      part({ local: 'A2' }),
      null
    );

    expect(linked.actions[0].payload).toMatchObject({
      storage_location_source: 'linked',
    });
    expect(pending.actions[0].payload).toMatchObject({
      storage_location_source: 'pending',
    });
  });
});
