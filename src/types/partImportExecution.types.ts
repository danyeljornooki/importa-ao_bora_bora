export type PartImportAction = 'created' | 'updated' | 'skipped' | 'failed';

export interface PartImportResult {
  action: PartImportAction;
  pecaId: string | null;
  error?: string | null;
}

export type PartImportAdLinkAction =
  | 'inserted'
  | 'updated'
  | 'linked'
  | 'pending'
  | 'failed'
  | 'skipped'
  | 'conflict'
  | 'invalid';

export interface PartImportAdLinkResult {
  action: PartImportAdLinkAction;
  mlbId?: string | null;
  chosenMlbId?: string | null;
  adId?: string | null;
  reason?: string | null;
  error?: string | null;
}

export type PartImportImageAction =
  | 'planned'
  | 'used_ml'
  | 'used_sheet'
  | 'no_image'
  | 'pending'
  | 'failed'
  | 'skipped';

export interface PartImportImageResult {
  action: PartImportImageAction;
  source: 'mercado_livre' | 'sheet' | 'none';
  count: number;
  urls: string[];
  error?: string | null;
}

export interface PartImportRowExecutionResult {
  row: number;
  partResult: PartImportResult;
  adLinkResult: PartImportAdLinkResult;
  imagePlan: PartImportImageResult;
  warnings: string[];
}

export interface PartImportComplementsSummary {
  complementPending: number;
  linkedAds: number;
  pendingAds: number;
  failedAds: number;
  mlImages: number;
  sheetImages: number;
  noImage: number;
}

export interface PartImportCommitSummary
  extends PartImportComplementsSummary {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  pending: number;
}
