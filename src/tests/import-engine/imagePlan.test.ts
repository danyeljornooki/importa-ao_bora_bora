import { describe, expect, it } from 'vitest';
import { buildImagePlan } from '../../core/images/buildImagePlan';

describe('buildImagePlan', () => {
  it('prioriza imagens do Mercado Livre', () => {
    expect(buildImagePlan({
      mlImageUrls: ['https://ml/a'],
      sheetImageUrls: ['https://sheet/a'],
    })).toMatchObject({
      action: 'used_ml',
      urls: ['https://ml/a'],
    });
  });

  it('usa planilha quando ML esta vazio', () => {
    expect(buildImagePlan({
      mlImageUrls: [],
      sheetImageUrls: ['https://sheet/a'],
    }).action).toBe('used_sheet');
  });

  it('retorna no_image quando nenhuma URL existe', () => {
    expect(buildImagePlan({}).action).toBe('no_image');
  });

  it('deduplica URLs', () => {
    expect(buildImagePlan({
      mlImageUrls: ['https://ml/a', 'https://ml/a'],
    }).urls).toEqual(['https://ml/a']);
  });
});
