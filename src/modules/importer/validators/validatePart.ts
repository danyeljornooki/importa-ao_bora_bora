import type { PartCanonical } from '../schemas/part.schema';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const isEmptyString = (value: unknown): boolean =>
  typeof value !== 'string' || value.trim().length === 0;

const isOnlySymbols = (value: unknown): boolean => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }
  return /^[\p{P}\p{S}\s]+$/u.test(value.trim());
};

const normalizeString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const isValidMlbId = (value: unknown): boolean =>
  typeof value === 'string' && /^MLB\d+$/i.test(value.trim());

export const validatePart = (part: PartCanonical): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  const price = part?.price;
  if (price === undefined || price === null || Number.isNaN(price)) {
    errors.push('price obrigatório');
  } else {
    if (typeof price !== 'number') {
      errors.push('price obrigatório');
    } else {
      if (price < 0) {
        errors.push('price deve ser >= 0');
      }
    }
  }

  const stockQuantity = part?.stock_quantity;
  if (stockQuantity !== undefined && stockQuantity !== null) {
    if (typeof stockQuantity !== 'number' || Number.isNaN(stockQuantity) || stockQuantity < 0) {
      errors.push('stock_quantity não pode ser negativo');
    }
  }

  const code = normalizeString(part?.code);
  if (code.length === 0) {
    warnings.push('peça sem código interno');
  }

  const title = normalizeString(part?.title);
  if (title.length === 0) {
    warnings.push('title ausente');
  }

  const location = normalizeString(part?.location);
  if (location.length === 0) {
    warnings.push('location ausente');
  } else {
    if (location.length < 2) {
      warnings.push('location suspeita: menor que 2 caracteres');
    }
  }

  const description = normalizeString(part?.description);
  if (description.length === 0) {
    warnings.push('description ausente');
  }

  if (isOnlySymbols(title) || isOnlySymbols(location) || isOnlySymbols(description)) {
    warnings.push('só símbolos');
  }

  const mlbIds = Array.isArray(part?.mlb_ids)
    ? part.mlb_ids.filter((value): value is string => typeof value === 'string')
    : [];

  if (mlbIds.length > 0) {
    const invalidIds = mlbIds.filter((id) => !isValidMlbId(id));
    if (invalidIds.length > 0) {
      warnings.push('MLB IDs inválidos; vínculo de anúncio ficará pendente');
    }
    if (mlbIds.length > 1) {
      warnings.push('múltiplos MLB IDs encontrados');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};
