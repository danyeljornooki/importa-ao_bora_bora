import type {
  StorageLocation,
  StorageLocationPayload,
} from './location.types';

export interface StorageLocationAdapter {
  findCandidates(storeId: string): Promise<StorageLocation[]>;
  createLocation(payload: StorageLocationPayload): Promise<StorageLocation>;
}
