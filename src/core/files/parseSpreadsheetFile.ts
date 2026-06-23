import Papa from 'papaparse';
import readExcelFile from 'read-excel-file/universal';

export type SpreadsheetFileType = 'csv' | 'xlsx' | 'xls';

export interface ParseSpreadsheetFileOptions {
  fileName?: string;
  sheetName?: string;
}

export interface ParsedSpreadsheetFile {
  rows: Record<string, string>[];
  columns: string[];
  totalRows: number;
  fileType: SpreadsheetFileType;
  sheetName?: string | null;
}

type SpreadsheetInput = File | Buffer | ArrayBuffer;
type Cell = string | number | boolean | Date | null | undefined;

const supportedExtensions = new Set<SpreadsheetFileType>(['csv', 'xlsx', 'xls']);

const isFileLike = (input: SpreadsheetInput): input is File =>
  typeof File !== 'undefined' && input instanceof File;

const inputName = (
  input: SpreadsheetInput,
  options?: ParseSpreadsheetFileOptions
): string => {
  if (options?.fileName) return options.fileName;
  if (isFileLike(input) && input.name) return input.name;
  return '';
};

const detectFileType = (fileName: string): SpreadsheetFileType => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension && supportedExtensions.has(extension as SpreadsheetFileType)) {
    return extension as SpreadsheetFileType;
  }
  throw new Error(
    'Tipo de arquivo inválido. Envie um arquivo .csv, .xlsx ou .xls.'
  );
};

const toArrayBuffer = async (input: SpreadsheetInput): Promise<ArrayBuffer> => {
  if (isFileLike(input)) return input.arrayBuffer();
  if (input instanceof ArrayBuffer) return input;

  const view = input as Buffer;
  return view.buffer.slice(
    view.byteOffset,
    view.byteOffset + view.byteLength
  ) as ArrayBuffer;
};

const readText = async (input: SpreadsheetInput): Promise<string> => {
  if (isFileLike(input)) return input.text();
  return new TextDecoder('utf-8').decode(await toArrayBuffer(input));
};

const cellToString = (value: Cell): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

const hasAnyValue = (values: string[]): boolean =>
  values.some((value) => value.trim() !== '');

const toRows = (table: Cell[][], fileType: SpreadsheetFileType, sheetName?: string | null): ParsedSpreadsheetFile => {
  const normalized = table.map((row) => row.map(cellToString));
  const headerIndex = normalized.findIndex(hasAnyValue);
  if (headerIndex === -1) {
    throw new Error('Arquivo inválido: nenhuma coluna foi encontrada.');
  }

  const columns = normalized[headerIndex].map((column) => column.trim());
  if (!hasAnyValue(columns)) {
    throw new Error('Arquivo inválido: cabeçalho vazio.');
  }

  const rows = normalized
    .slice(headerIndex + 1)
    .filter(hasAnyValue)
    .map((values) => {
      const row: Record<string, string> = {};
      columns.forEach((column, index) => {
        if (!column) return;
        row[column] = values[index] ?? '';
      });
      return row;
    });

  return {
    rows,
    columns: columns.filter((column) => column !== ''),
    totalRows: rows.length,
    fileType,
    sheetName,
  };
};

const parseCsv = async (
  input: SpreadsheetInput,
  fileType: SpreadsheetFileType
): Promise<ParsedSpreadsheetFile> => {
  const text = await readText(input);
  const result = Papa.parse<string[]>(text, {
    dynamicTyping: false,
    skipEmptyLines: false,
  });

  const fatalError = result.errors.find((error) => error.code !== 'UndetectableDelimiter');
  if (fatalError) {
    const error = fatalError;
    throw new Error(`CSV inválido: ${error.message}`);
  }

  return toRows(result.data, fileType, null);
};

const parseWorkbook = async (
  input: SpreadsheetInput,
  fileType: SpreadsheetFileType,
  options?: ParseSpreadsheetFileOptions
): Promise<ParsedSpreadsheetFile> => {
  const workbookInput = await toArrayBuffer(input);
  const sheets = await readExcelFile(workbookInput);
  if (!Array.isArray(sheets) || sheets.length === 0) {
    throw new Error('Arquivo Excel inválido: nenhuma aba foi encontrada.');
  }

  const selected = options?.sheetName
    ? sheets.find((sheet) => sheet.sheet === options.sheetName)
    : sheets[0];

  if (!selected) {
    throw new Error(`Arquivo Excel inválido: aba "${options?.sheetName}" não encontrada.`);
  }

  return toRows(selected.data as Cell[][], fileType, selected.sheet ?? null);
};

export const parseSpreadsheetFile = async (
  file: SpreadsheetInput,
  options?: ParseSpreadsheetFileOptions
): Promise<ParsedSpreadsheetFile> => {
  const fileType = detectFileType(inputName(file, options));

  try {
    if (fileType === 'csv') return parseCsv(file, fileType);
    return parseWorkbook(file, fileType, options);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Arquivo')) {
      throw error;
    }
    if (error instanceof Error && error.message.startsWith('CSV')) {
      throw error;
    }
    throw new Error(`Falha ao ler planilha: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export default parseSpreadsheetFile;
