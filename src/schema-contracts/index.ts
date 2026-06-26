import { importRunItemsContract } from './importRunItems.contract';
import { importRunsContract } from './importRuns.contract';
import { inventoryItemsContract } from './inventoryItems.contract';
import { mercadoLivreBrasilAnuncioContract } from './mercadoLivreBrasilAnuncio.contract';
import { parteContract } from './parte.contract';
import { storageLocationsContract } from './storageLocations.contract';

export const schemaContracts = [
  parteContract,
  storageLocationsContract,
  inventoryItemsContract,
  mercadoLivreBrasilAnuncioContract,
  importRunsContract,
  importRunItemsContract,
] as const;

export {
  importRunItemsContract,
  importRunsContract,
  inventoryItemsContract,
  mercadoLivreBrasilAnuncioContract,
  parteContract,
  storageLocationsContract,
};
