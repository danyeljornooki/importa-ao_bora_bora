/**
 * Estratégia de origem da DESCRIÇÃO da peça, escolhida pelo usuário por importação.
 *
 * Cada cliente/importação pode querer uma regra diferente:
 *  - 'sheet'         -> sempre a descrição da planilha
 *  - 'ml'            -> sempre a do anúncio do Mercado Livre
 *  - 'sheet_then_ml' -> a da planilha; se não houver, a do ML (padrão)
 *  - 'ml_then_sheet' -> a do ML; se não houver, a da planilha
 *
 * Modulo PURO. A descrição do ML chega aqui já resolvida (vem do anúncio durante
 * o enriquecimento). Este resolver só decide qual usar.
 */

export type DescriptionStrategy = 'sheet' | 'ml' | 'sheet_then_ml' | 'ml_then_sheet';

export interface DescriptionSources {
  sheet?: string | null;
  ml?: string | null;
}

const clean = (value?: string | null): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export const resolveDescription = (
  sources: DescriptionSources,
  strategy: DescriptionStrategy = 'sheet_then_ml'
): string | null => {
  const sheet = clean(sources.sheet);
  const ml = clean(sources.ml);

  switch (strategy) {
    case 'sheet':
      return sheet;
    case 'ml':
      return ml;
    case 'ml_then_sheet':
      return ml ?? sheet;
    case 'sheet_then_ml':
    default:
      return sheet ?? ml;
  }
};

export default resolveDescription;
