import type { PartImportImageResult } from '../../types/partImportExecution.types';

export interface BuildImagePlanInput {
  mlImageUrls?: unknown[];
  sheetImageUrls?: unknown[];
}

const normalizeUrls = (values: unknown[] | undefined): string[] => [
  ...new Set(
    (values ?? [])
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean)
  ),
];

export const buildImagePlan = ({
  mlImageUrls,
  sheetImageUrls,
}: BuildImagePlanInput): PartImportImageResult => {
  const mercadoLivreUrls = normalizeUrls(mlImageUrls);
  if (mercadoLivreUrls.length > 0) {
    return {
      action: 'used_ml',
      source: 'mercado_livre',
      count: mercadoLivreUrls.length,
      urls: mercadoLivreUrls,
      error: null,
    };
  }

  const sheetUrls = normalizeUrls(sheetImageUrls);
  if (sheetUrls.length > 0) {
    return {
      action: 'used_sheet',
      source: 'sheet',
      count: sheetUrls.length,
      urls: sheetUrls,
      error: null,
    };
  }

  return {
    action: 'no_image',
    source: 'none',
    count: 0,
    urls: [],
    error: null,
  };
};

export default buildImagePlan;
