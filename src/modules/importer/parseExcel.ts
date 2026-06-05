import * as XLSX from 'xlsx';

export interface ParsedExcel {
  sheetName: string;
  availableSheets: string[];
  rows: Record<string, unknown>[];
}

const normalizeCsvText = (text: string): string => {
  return text.replace(/^\uFEFF/, '');
};

const hasBrokenEncoding = (text: string): boolean => {
  return text.includes('Ã') || text.includes('�');
};

const fixMojibake = (text: string): string => {
  if (!text) return text;
  const map: Record<string, string> = {
    'Ã¡': 'á',
    'Ã�': 'Á',
    'Ã ': 'à',
    'Ãª': 'ê',
    'Ã©': 'é',
    'Ã§': 'ç',
    'Ã£': 'ã',
    'Ãµ': 'õ',
    'Ã³': 'ó',
    'Ã´': 'ô',
    'Ãº': 'ú',
    'Ã‰': 'É',
    'â€“': '-',
    'â€”': '-',
    'â€˜': "'",
    'â€™': "'",
    'â€œ': '"',
    'â€': '"',
  };

  let out = text;
  for (const k of Object.keys(map)) {
    out = out.split(k).join(map[k]);
  }

  try {
    out = out.normalize('NFC');
  } catch {}

  return out;
};

const decodeCsvBuffer = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const utf8Text = normalizeCsvText(new TextDecoder('utf-8').decode(buffer));
  // quick attempt: try to fix common mojibake sequences first
  const maybeFixed = fixMojibake(utf8Text);
  if (!hasBrokenEncoding(maybeFixed)) {
    return maybeFixed;
  }

  try {
    const windowsTextRaw = normalizeCsvText(new TextDecoder('windows-1252').decode(buffer));
    const windowsText = fixMojibake(windowsTextRaw);
    if (!hasBrokenEncoding(windowsText)) {
      return windowsText;
    }
  } catch {
    // fallback to iso-8859-1 when windows-1252 is unavailable
  }

  const isoTextRaw = normalizeCsvText(new TextDecoder('iso-8859-1').decode(buffer));
  const isoText = fixMojibake(isoTextRaw);
  return isoText;
};

const getFileExtension = (fileName: string): string => {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
};

export const parseExcel = async (file: File): Promise<ParsedExcel> => {
  if (!(file instanceof File)) {
    throw new Error('parseExcel espera um File válido.');
  }

  try {
    const extension = getFileExtension(file.name);
    const workbook =
      extension === 'csv'
        ? XLSX.read(await decodeCsvBuffer(file), { type: 'string' })
        : XLSX.read(await file.arrayBuffer(), { type: 'array' });

    const sheetName = workbook.SheetNames[0] ?? '';

    if (!sheetName) {
      return { sheetName: '', availableSheets: [], rows: [] };
    }

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      return { sheetName, availableSheets: workbook.SheetNames, rows: [] };
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: null,
      raw: false,
      blankrows: false,
    });

    return {
      sheetName,
      availableSheets: workbook.SheetNames,
      rows: Array.isArray(rows) ? rows : [],
    };
  } catch (error) {
    throw new Error('Falha ao ler arquivo Excel: ' + (error instanceof Error ? error.message : String(error)));
  }
};

// if (!fileBuffer || !(fileBuffer instanceof ArrayBuffer)) {