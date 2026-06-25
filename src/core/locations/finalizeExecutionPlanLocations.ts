import type { PartCanonical } from '../../modules/importer/schemas/part.schema';
import type {
  ExecutionAction,
  ExecutionPlan,
} from '../../planners/buildExecutionPlan';
import type { InventoryPersistencePatch } from '../../types/inventory.types';
import { getPartRawLocation } from './getPartRawLocation';
import { resolveStorageLocation } from './resolveStorageLocation';
import type { StorageLocation } from './location.types';
import type { StorageLocationAdapter } from './storageLocationAdapter';

export const LOCATION_PENDING_MESSAGE =
  'Localização informada na planilha, mas não foi possível criar/vincular em storage_locations.';

const resolvedId = (location: StorageLocation): string | null => {
  const value = location.id ?? location._id;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
};

const resolvedName = (
  location: StorageLocation,
  rawLocation: string
): string =>
  location.path_text?.trim() ||
  location.location_path_text?.trim() ||
  location.name?.trim() ||
  rawLocation;

const pendingPatch = (rawLocation: string): InventoryPersistencePatch => ({
  storage_location_id: null,
  storage_location_name: rawLocation,
  storage_location_source: 'pending',
});

const warning = (): string =>
  `location_pending: ${LOCATION_PENDING_MESSAGE}`;

const finalizeAction = async (
  action: ExecutionAction,
  part: PartCanonical | undefined,
  storeId: string,
  adapter: StorageLocationAdapter | null
): Promise<ExecutionAction> => {
  if (
    (action.type !== 'create' && action.type !== 'update') ||
    !action.payload
  ) {
    return action;
  }

  const rawLocation = getPartRawLocation(part);
  if (!rawLocation) return action;

  try {
    const resolved = adapter
      ? await resolveStorageLocation(
          { storeId, rawLocation, createdBy: storeId },
          adapter
        )
      : null;
    const locationId = resolved ? resolvedId(resolved.location) : null;

    if (!resolved || !locationId) {
      return {
        ...action,
        payload: { ...action.payload, ...pendingPatch(rawLocation) },
        warnings: [...new Set([...(action.warnings ?? []), warning()])],
      };
    }

    return {
      ...action,
      payload: {
        ...action.payload,
        storage_location_id: locationId,
        storage_location_name: resolvedName(resolved.location, rawLocation),
        storage_location_source: 'linked',
      },
    };
  } catch {
    return {
      ...action,
      payload: { ...action.payload, ...pendingPatch(rawLocation) },
      warnings: [...new Set([...(action.warnings ?? []), warning()])],
    };
  }
};

export const finalizeExecutionPlanLocations = async (
  executionPlan: ExecutionPlan,
  partsByRow: Map<number, PartCanonical>,
  options: {
    storeId: string;
    storageLocationAdapter?: StorageLocationAdapter | null;
  }
): Promise<ExecutionPlan> => {
  const actions: ExecutionAction[] = [];

  for (const action of executionPlan.actions) {
    actions.push(await finalizeAction(
      action,
      partsByRow.get(action.row),
      options.storeId,
      options.storageLocationAdapter ?? null
    ));
  }

  return {
    summary: { ...executionPlan.summary },
    actions,
  };
};
