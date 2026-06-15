import type { CanonicalPart } from './part.types';

export interface CanonicalPartValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const hasText = (value: unknown): boolean =>
  typeof value === 'string' && value.trim() !== '';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isHttpUrl = (value: unknown): boolean => {
  if (!hasText(value)) return false;

  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const validateCanonicalPart = (
  part: CanonicalPart
): CanonicalPartValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!part || typeof part !== 'object') {
    return {
      valid: false,
      errors: ['CanonicalPart deve ser um objeto.'],
      warnings,
    };
  }

  if (!hasText(part.identity?.storeId)) {
    errors.push('identity.storeId e obrigatorio.');
  }

  if (!hasText(part.identity?.title)) {
    errors.push('identity.title e obrigatorio.');
  }

  const price = part.commercial?.price;
  if (!isFiniteNumber(price)) {
    errors.push('commercial.price e obrigatorio e deve ser numerico.');
  } else if (price < 0) {
    errors.push('commercial.price deve ser maior ou igual a zero.');
  }

  const stockQuantity = part.commercial?.stockQuantity;
  if (!isFiniteNumber(stockQuantity)) {
    errors.push(
      'commercial.stockQuantity e obrigatorio e deve ser numerico.'
    );
  } else {
    if (stockQuantity < 0) {
      errors.push(
        'commercial.stockQuantity deve ser maior ou igual a zero.'
      );
    }
    if (!Number.isInteger(stockQuantity)) {
      errors.push('commercial.stockQuantity deve ser inteiro.');
    }
  }

  const marketplaceLinks = Array.isArray(part.marketplace)
    ? part.marketplace
    : [];
  const hasMarketplaceId = marketplaceLinks.some((link) =>
    hasText(link?.marketplaceId)
  );
  const hasIdentity =
    (part.identity?.idInt !== null &&
      part.identity?.idInt !== undefined) ||
    hasText(part.identity?.idString) ||
    hasText(part.identity?.code) ||
    hasMarketplaceId;

  if (!hasIdentity) {
    errors.push(
      'A peca deve ter identity.idInt, identity.idString, identity.code ou marketplaceId.'
    );
  }

  if (!Array.isArray(part.images)) {
    errors.push('images deve ser uma lista.');
  } else {
    part.images.forEach((image, index) => {
      if (!isHttpUrl(image?.url)) {
        errors.push(
          `images[${index}].url deve ser uma URL http/https valida.`
        );
      }
    });
  }

  if (!Array.isArray(part.marketplace)) {
    errors.push('marketplace deve ser uma lista.');
  } else {
    part.marketplace.forEach((link, index) => {
      if (!hasText(link?.marketplace)) {
        errors.push(`marketplace[${index}].marketplace e obrigatorio.`);
      }
      if (!hasText(link?.marketplaceId)) {
        errors.push(`marketplace[${index}].marketplaceId e obrigatorio.`);
      }
      if (!hasText(link?.integrationId)) {
        warnings.push(
          `marketplace[${index}] nao possui integrationId; o mapper usara uma chave de fallback.`
        );
      }
    });
  }

  if (!hasText(part.commercial?.status)) {
    errors.push('commercial.status deve ser calculado ou informado.');
  }

  if (marketplaceLinks.length === 0) {
    warnings.push('A peca nao possui vinculos de marketplace.');
  }

  if (Array.isArray(part.images) && part.images.length === 0) {
    warnings.push('A peca nao possui imagens.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};

export default validateCanonicalPart;
