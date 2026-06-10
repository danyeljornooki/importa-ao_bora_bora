import type { PartChange } from '../modules/importer/comparators/comparePart';
import type { PartCanonical } from '../modules/importer/schemas/part.schema';
import { resolveLocation } from '../services/resolveLocation';
import type {
  ExistingInventoryItem,
  InventoryPersistencePatch,
} from '../types/inventory.types';

export interface BuildUpdatePatchInput {
  incomingPart: PartCanonical;
  existingPart: ExistingInventoryItem;
  changes: PartChange[];
  context: {
    storeId: string;
  };
}

const normalizeName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const firstMlbId = (part: PartCanonical): string | null => {
  if (part.id_string?.trim()) {
    return part.id_string.trim();
  }

  if (Array.isArray(part.mlb_ids)) {
    const value = part.mlb_ids.find(
      (item) => typeof item === 'string' && item.trim() !== ''
    );
    return value?.trim() ?? null;
  }

  return null;
};

export const buildUpdatePatch = ({
  incomingPart,
  existingPart,
  changes,
  context,
}: BuildUpdatePatchInput): InventoryPersistencePatch => {
  if (!context.storeId || context.storeId.trim() === '') {
    throw new Error('storeId obrigatorio para buildUpdatePatch');
  }

  if (!existingPart?.id || String(existingPart.id).trim() === '') {
    throw new Error('existingPart.id obrigatorio para buildUpdatePatch');
  }

  const changedFields = new Set(changes.map((change) => change.field));
  const patch: InventoryPersistencePatch = {};

  if (changedFields.has('price')) {
    patch.price = incomingPart.price;
    patch.marketplace_price = incomingPart.price;
  }

  if (
    changedFields.has('stock_quantity') &&
    incomingPart.stock_quantity !== null &&
    incomingPart.stock_quantity !== undefined
  ) {
    patch.stock_quantity = incomingPart.stock_quantity;
    patch.status = incomingPart.stock_quantity > 0
      ? 'DISPONIVEL'
      : 'SEM_ESTOQUE';
  }

  if (changedFields.has('location') && incomingPart.location?.trim()) {
    const resolvedLocation = resolveLocation(incomingPart.location);
    patch.storage_location_name =
      resolvedLocation?.descricao ?? incomingPart.location.trim();

    if (resolvedLocation?._id) {
      patch.storage_location_id = resolvedLocation._id;
    }
  }

  if (changedFields.has('title') && incomingPart.title?.trim()) {
    patch.marketplace_name = incomingPart.title.trim();
    patch.marketplace_name_normalized = normalizeName(incomingPart.title);
  }

  if (changedFields.has('description') && incomingPart.description !== undefined) {
    patch.description = incomingPart.description;
  }

  if (
    changedFields.has('code') &&
    incomingPart.code !== null &&
    incomingPart.code !== undefined
  ) {
    patch.code = incomingPart.code;
  }

  if (
    changedFields.has('id_int') &&
    incomingPart.id_int !== null &&
    incomingPart.id_int !== undefined
  ) {
    const idInt = Number(String(incomingPart.id_int).trim());
    if (Number.isFinite(idInt)) {
      patch.id_int = idInt;
    }
  }

  if (changedFields.has('mlb_ids') || changedFields.has('id_string')) {
    const idString = firstMlbId(incomingPart);
    if (idString) {
      patch.id_string = idString;
    }
  }

  return patch;
};

export default buildUpdatePatch;
