import { describe, expect, it } from 'vitest';
import { MONGO_COLLECTIONS } from '../../adapters/mongo/collectionNames';
import {
  inventoryItemsContract,
  mercadoLivreBrasilAnuncioContract,
  schemaContracts,
  storageLocationsContract,
} from '../../schema-contracts';

const findIndex = (
  indexes: Array<{ name: string; key: Record<string, 1 | -1> }>,
  key: Record<string, 1 | -1>
) => indexes.find((index) => JSON.stringify(index.key) === JSON.stringify(key));

describe('mongo schema contracts', () => {
  it('declares all expected collections', () => {
    expect(schemaContracts.map((contract) => contract.mongoCollection)).toEqual([
      MONGO_COLLECTIONS.parte,
      MONGO_COLLECTIONS.storageLocations,
      MONGO_COLLECTIONS.inventoryItems,
      MONGO_COLLECTIONS.mercadoLivreBrasilAnuncio,
      MONGO_COLLECTIONS.importRuns,
      MONGO_COLLECTIONS.importRunItems,
    ]);
  });

  it('keeps logical names aligned with mongo collection names', () => {
    for (const contract of schemaContracts) {
      expect(contract.logicalName).toBe(contract.mongoCollection);
      expect(contract.idMapping.mongo).toBe('_id');
      expect(contract.idMapping.domain).toBe('id');
    }
  });

  it('uses mercado_livre_brasil_anuncio as the Mongo target for ML ads', () => {
    expect(mercadoLivreBrasilAnuncioContract.mongoCollection).toBe('mercado_livre_brasil_anuncio');
    expect(mercadoLivreBrasilAnuncioContract.supabaseTable).toBe('marketplace_ads');
  });

  it('declares n8n indexes for mercado_livre_brasil_anuncio lookup by mlb_id and data.id', () => {
    expect(
      findIndex(mercadoLivreBrasilAnuncioContract.indexes, { integration_id: 1, mlb_id: 1 })
    ).toBeTruthy();
    expect(
      findIndex(mercadoLivreBrasilAnuncioContract.indexes, { integration_id: 1, 'data.id': 1 })
    ).toBeTruthy();
  });

  it('declares main match indexes for inventory_items', () => {
    expect(findIndex(inventoryItemsContract.indexes, { store_id: 1, id_int: 1 })).toBeTruthy();
    expect(findIndex(inventoryItemsContract.indexes, { store_id: 1, id_string: 1 })).toBeTruthy();
    expect(findIndex(inventoryItemsContract.indexes, { store_id: 1, code: 1 })).toBeTruthy();
    expect(findIndex(inventoryItemsContract.indexes, { store_id: 1, tag_code: 1 })).toBeTruthy();
    expect(
      findIndex(inventoryItemsContract.indexes, { store_id: 1, identifier_search_keys: 1 })
    ).toBeTruthy();
  });

  it('declares storage location lookup index used by n8n', () => {
    expect(
      findIndex(storageLocationsContract.indexes, { store_id: 1, name: 1, status: 1 })
    ).toBeTruthy();
  });
});
