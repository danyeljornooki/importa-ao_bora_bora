import type { ImportWriteTarget } from '../types';

const notWired = async (): Promise<never> => {
  throw new Error('Supabase import target wrapper ainda usa o fluxo oficial existente.');
};

export const supabaseImportTarget: ImportWriteTarget = {
  name: 'supabase',
  createImportRun: notWired,
  updateImportRun: notWired,
  createImportRunItem: notWired,
  findInventoryItem: notWired,
  createInventoryItem: notWired,
  updateInventoryItem: notWired,
  findStorageLocation: notWired,
  createStorageLocation: notWired,
  findMarketplaceAd: notWired,
  upsertMarketplaceAd: notWired,
  findPartCategory: notWired,
};
