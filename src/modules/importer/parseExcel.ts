import { parseImportFile } from './parseImportFile';

// LEGADO: nao usar em novos fluxos. Mantido temporariamente apenas para compatibilidade.
// Novos fluxos devem usar src/modules/importer/parseImportFile.ts.
export interface ParsedExcel {
  sheetName: string;
  availableSheets: string[];
  rows: Record<string, unknown>[];
}

export const parseExcel = async (file: File): Promise<ParsedExcel> => {
  if (!(file instanceof File)) {
    throw new Error('parseExcel espera um File valido.');
  }

  const parsed = await parseImportFile(file, { fileName: file.name });

  return {
    sheetName: parsed.sheetName,
    availableSheets: parsed.availableSheets,
    rows: parsed.rows,
  };
};
