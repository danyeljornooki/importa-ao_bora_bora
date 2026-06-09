import type { PartCanonical } from '../schemas/part.schema';
import type { ExistingInventoryItem } from '../../../types/inventory.types';
import {
  buildInventoryIndex,
  normalizeIndexKey,
  normalizeTitleKey,
  type InventoryIndex,
} from '../matching/buildInventoryIndex';

export type MatchAction = 'create' | 'update' | 'conflict';
export type MatchSource = 'id_int' | 'code' | 'mlb_id' | 'title' | null;

export interface MatchResult {
  action: MatchAction;
  matchedBy: MatchSource;
  confidence: number;
  existingPart?: ExistingInventoryItem;
  warnings: string[];
}

const getMlbIds = (part: PartCanonical): string[] => {
  const values = Array.isArray(part.mlb_ids) ? part.mlb_ids : [];
  const explicitIdString = part.id_string ? [part.id_string] : [];

  return [...explicitIdString, ...values]
    .map((value) => normalizeIndexKey(value))
    .filter((value): value is string => !!value);
};

const titleConflict = (incomingTitle: string, existingTitle: string): boolean => {
  if (incomingTitle === existingTitle) return true;

  if (incomingTitle.includes(existingTitle) || existingTitle.includes(incomingTitle)) {
    const incomingWords = incomingTitle.split(' ');
    const existingWords = existingTitle.split(' ');
    const sharedWords = incomingWords.filter((word) => existingWords.includes(word));
    return sharedWords.length >= Math.min(2, Math.floor(Math.max(incomingWords.length, existingWords.length) / 2));
  }

  return false;
};

const ensureIndex = (inventory: InventoryIndex | ExistingInventoryItem[]): InventoryIndex =>
  Array.isArray(inventory) ? buildInventoryIndex(inventory) : inventory;

export const matchPart = (
  importedPart: PartCanonical,
  inventory: InventoryIndex | ExistingInventoryItem[]
): MatchResult => {
  const defaultResult: MatchResult = {
    action: 'create',
    matchedBy: null,
    confidence: 0,
    warnings: [],
  };

  if (!importedPart || typeof importedPart !== 'object') {
    return defaultResult;
  }

  const index = ensureIndex(inventory);

  const idInt = normalizeIndexKey(importedPart.id_int);
  if (idInt) {
    const existingPart = index.byIdInt.get(idInt);
    if (existingPart) {
      return { action: 'update', matchedBy: 'id_int', confidence: 100, existingPart, warnings: [] };
    }
  }

  const code = normalizeIndexKey(importedPart.code);
  if (code) {
    const existingPart = index.byCode.get(code);
    if (existingPart) {
      return { action: 'update', matchedBy: 'code', confidence: 98, existingPart, warnings: [] };
    }
  }

  for (const mlbId of getMlbIds(importedPart)) {
    const existingPart = index.byIdString.get(mlbId);
    if (existingPart) {
      return { action: 'update', matchedBy: 'mlb_id', confidence: 95, existingPart, warnings: [] };
    }
  }

  const incomingTitle = normalizeTitleKey(importedPart.title);
  if (incomingTitle) {
    for (const candidate of index.titleCandidates) {
      if (titleConflict(incomingTitle, candidate.normalizedTitle)) {
        return {
          action: 'conflict',
          matchedBy: 'title',
          confidence: 40,
          existingPart: candidate.item,
          warnings: ['possivel peca ja cadastrada por titulo semelhante'],
        };
      }
    }
  }

  return defaultResult;
};

export default matchPart;
