import type { ImportTargetName } from './types';

export const DEFAULT_IMPORT_TARGET: ImportTargetName = 'supabase';

export const normalizeImportTargetName = (
  value?: string | null
): ImportTargetName => {
  if (value === 'mongo' || value === 'supabase') {
    return value;
  }
  return DEFAULT_IMPORT_TARGET;
};

export const getDefaultImportTargetName = (): ImportTargetName =>
  normalizeImportTargetName(process.env.IMPORT_TARGET_DEFAULT);
