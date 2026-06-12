import type { ImportExecutionContext } from './integration.types';
import type { ExistingInventoryItem } from './inventory.types';
import type { MarketplaceListing } from './marketplace.types';
import type { MarketplaceAd } from './marketplaceAd.types';

export interface AdLinkInput {
  peca: ExistingInventoryItem;
  context: ImportExecutionContext;
  mlbIds: string[];
}

export interface AdLinkCandidate {
  mlbId: string;
  ok: boolean;
  item?: MarketplaceListing;
  rawItem?: unknown;
  description?: {
    plainText?: string | null;
    raw?: unknown;
  };
  score: number;
  scoreDetails: string[];
  errorStatus?: number | null;
  errorMessage?: string | null;
  useCache?: boolean;
}

export type AdLinkAction =
  | 'link_existing_ad'
  | 'insert_new_ad'
  | 'conflict'
  | 'invalid';

export interface AdLinkDecision {
  action: AdLinkAction;
  pecaId: string;
  chosenMlbId?: string | null;
  chosenCandidate?: AdLinkCandidate | null;
  candidates: AdLinkCandidate[];
  invalidCandidates: AdLinkCandidate[];
  registryRecords: MarketplaceAd[];
  reason: string;
  warnings: string[];
}
