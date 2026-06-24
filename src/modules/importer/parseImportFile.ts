import {
  parseSpreadsheetFile,
  type ParsedSpreadsheetFile,
} from '../../core/files/parseSpreadsheetFile';

export interface ParseImportFileOptions {
  fileName?: string;
}

export interface ParsedImportFile {
  rows: Record<string, unknown>[];
  columns: string[];
  totalRows: number;
  sheetName: string;
  availableSheets: string[];
}

type ImportFileInput = File | Buffer | ArrayBuffer;

const inferFileName = (
  file: ImportFileInput,
  options?: ParseImportFileOptions
): string => {
  if (options?.fileName) return options.fileName;
  if (typeof File !== 'undefined' && file instanceof File && file.name) {
    return file.name;
  }
  return 'import.xlsx';
};

const toParsedImportFile = (
  parsed: ParsedSpreadsheetFile
): ParsedImportFile => {
  const sheetName = parsed.sheetName ?? '';

  return {
    rows: parsed.rows,
    columns: parsed.columns,
    totalRows: parsed.totalRows,
    sheetName,
    availableSheets: sheetName ? [sheetName] : [],
  };
};

export const parseImportFile = async (
  file: ImportFileInput,
  options?: ParseImportFileOptions
): Promise<ParsedImportFile> => {
  try {
    const parsed = await parseSpreadsheetFile(file, {
      fileName: inferFileName(file, options),
    });
    return toParsedImportFile(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Falha ao ler arquivo de importacao: ${message}`);
  }
};

export default parseImportFile;
