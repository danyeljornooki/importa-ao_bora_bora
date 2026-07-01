import { describe, expect, it } from 'vitest';
import {
  getDefaultImportTargetName,
  normalizeImportTargetName,
} from '../../engine/import-targets/selectImportTarget';
import { supabaseImportTarget } from '../../engine/import-targets/supabase/supabaseImportTarget';

describe('import target selection', () => {
  it('defaults to supabase when target is absent or invalid', () => {
    expect(normalizeImportTargetName(undefined)).toBe('supabase');
    expect(normalizeImportTargetName('')).toBe('supabase');
    expect(normalizeImportTargetName('other')).toBe('supabase');
  });

  it('accepts explicit mongo target', () => {
    expect(normalizeImportTargetName('mongo')).toBe('mongo');
  });

  it('keeps supabase as wrapper default', () => {
    expect(supabaseImportTarget.name).toBe('supabase');
  });

  it('reads IMPORT_TARGET_DEFAULT but falls back to supabase', () => {
    const old = process.env.IMPORT_TARGET_DEFAULT;
    delete process.env.IMPORT_TARGET_DEFAULT;
    expect(getDefaultImportTargetName()).toBe('supabase');
    process.env.IMPORT_TARGET_DEFAULT = 'mongo';
    expect(getDefaultImportTargetName()).toBe('mongo');
    process.env.IMPORT_TARGET_DEFAULT = old;
  });
});
