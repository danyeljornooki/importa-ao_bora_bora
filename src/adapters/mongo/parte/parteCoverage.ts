import type { Collection, Document } from 'mongodb';
import { parseImportFile } from '../../../modules/importer/parseImportFile';

export interface ParteCoverageReport {
  required: string[];
  found: string[];
  missing: string[];
  coveragePercent: number;
  rows: number;
}

const asString = (value: unknown): string | null =>
  value === null || value === undefined || String(value).trim() === ''
    ? null
    : String(value).trim();

const normalizeHeader = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const CATEGORY_HEADERS = [
  'MLB_categoria_id',
  'mercado_libre_brasil_category_id',
  'category_id',
  'categoria_mlb',
  'categoria mlb',
];

export const extractMlbCategoryIdsFromRows = (
  rows: Record<string, unknown>[]
): string[] => {
  const ids = new Set<string>();
  for (const row of rows) {
    const normalizedKeys = Object.fromEntries(
      Object.keys(row).map((key) => [normalizeHeader(key), key])
    );

    for (const header of CATEGORY_HEADERS) {
      const originalKey = normalizedKeys[normalizeHeader(header)];
      const value = originalKey ? asString(row[originalKey]) : null;
      if (value) ids.add(value);
    }
  }
  return Array.from(ids).sort();
};

export const buildParteCoverageReport = async (
  collection: Pick<Collection<Document>, 'find'>,
  requiredCategoryIds: string[],
  rows: number
): Promise<ParteCoverageReport> => {
  const required = Array.from(new Set(requiredCategoryIds.filter(Boolean))).sort();
  if (required.length === 0) {
    return { required, found: [], missing: [], coveragePercent: 0, rows };
  }

  const docs = await collection
    .find(
      { MLB_categoria_id: { $in: required } },
      { projection: { MLB_categoria_id: 1 } }
    )
    .toArray();
  const found = Array.from(
    new Set(docs.map((doc) => asString(doc.MLB_categoria_id)).filter((id): id is string => !!id))
  ).sort();
  const foundSet = new Set(found);
  const missing = required.filter((id) => !foundSet.has(id));

  return {
    required,
    found,
    missing,
    coveragePercent: Math.round((found.length / required.length) * 10000) / 100,
    rows,
  };
};

export const loadParteCoverageFromFile = async (
  fileBuffer: Buffer,
  fileName: string,
  collection: Pick<Collection<Document>, 'find'>
): Promise<ParteCoverageReport> => {
  const parsed = await parseImportFile(fileBuffer, { fileName });
  const required = extractMlbCategoryIdsFromRows(parsed.rows);
  return buildParteCoverageReport(collection, required, parsed.totalRows);
};
