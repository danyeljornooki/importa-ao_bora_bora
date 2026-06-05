export interface NormalizedImportError {
  code: string;
  message: string;
}

export const normalizeImportError = (error: unknown): NormalizedImportError => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const lower = message.toLowerCase();

  let code = 'UNKNOWN_ERROR';

  if (lower.includes('code') || lower.includes('campo obrigatório "code"') || lower.includes('campo obrigatório "codigo"')) {
    code = 'INVALID_CODE';
  } else if (lower.includes('price') || lower.includes('preço') || lower.includes('valor')) {
    code = 'INVALID_PRICE';
  } else if (lower.includes('mlb') || lower.includes('mlb id') || lower.includes('mlb_id')) {
    code = 'INVALID_MLB';
  } else if (lower.includes('excel') || lower.includes('xlsx') || lower.includes('csv') || lower.includes('falha ao ler arquivo')) {
    code = 'PARSE_ERROR';
  }

  return {
    code,
    message,
  };
};

export default normalizeImportError;
