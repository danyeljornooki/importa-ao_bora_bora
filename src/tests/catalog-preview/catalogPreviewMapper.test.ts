import { describe, expect, it } from 'vitest';
import { mapCatalogPreviewPart } from '../../features/catalog-preview/catalogPreviewMapper';

const baseRow = {
  id: 'part-1',
  store_id: 'store-1',
  marketplace_name: 'Farol Gol',
  stock_quantity: 2,
  price: 100,
};

describe('catalogPreviewMapper', () => {
  it('peca sem imagem usa null', () => {
    const result = mapCatalogPreviewPart(baseRow);
    expect(result.mainImageUrl).toBeNull();
  });

  it('displayCode usa code antes de id_int/id_string/mlb', () => {
    const result = mapCatalogPreviewPart({
      ...baseRow,
      code: 'COD-1',
      id_int: 123,
      id_string: 'MLB1',
      primary_anuncio_mlb_id: 'MLB2',
    });
    expect(result.displayCode).toBe('COD-1');
  });

  it('displayCode usa id_int quando nao ha code', () => {
    const result = mapCatalogPreviewPart({ ...baseRow, id_int: 123, id_string: 'MLB1' });
    expect(result.displayCode).toBe('123');
  });

  it('vehicleLabel monta marca modelo ano', () => {
    const result = mapCatalogPreviewPart({
      ...baseRow,
      vehicle_brand_name: 'VW',
      vehicle_model_name: 'Gol',
      vehicle_year: '2010',
    });
    expect(result.vehicleLabel).toBe('VW Gol 2010');
  });

  it('location fallback fica null para UI mostrar Sem localizacao', () => {
    const result = mapCatalogPreviewPart(baseRow);
    expect(result.locationName).toBeNull();
  });

  it('usa imagem do anuncio preferindo secure_url', () => {
    const result = mapCatalogPreviewPart(
      { ...baseRow, primary_anuncio_mlb_id: 'MLB123' },
      [{
        id: 'ad-1',
        peca_id: 'part-1',
        mlb_id: 'MLB123',
        pictures: [{ url: 'https://example.com/a.jpg', secure_url: 'https://secure.example.com/a.jpg' }],
      }]
    );

    expect(result.mainImageUrl).toBe('https://secure.example.com/a.jpg');
  });
});
