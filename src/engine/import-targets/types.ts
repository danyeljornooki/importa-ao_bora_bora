import type { Document } from 'mongodb';

export type ImportTargetName = 'supabase' | 'mongo';
export type ImportRunMode = 'dryRun' | 'write';

export interface ImportTargetMetadata {
  source: string;
  testRunId?: string;
  runId?: string;
  integrationId?: string;
  fileName?: string;
  importedAt: Date;
}

export interface ImportRunPayload {
  testRunId?: string;
  storeId: string;
  integrationId?: string | null;
  fileName?: string | null;
  target: ImportTargetName;
  status: string;
  mode: ImportRunMode;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  conflictCount: number;
  warningCount: number;
  metadata: ImportTargetMetadata;
}

export interface ImportRunResult {
  id: string;
}

export interface ImportRunItemPayload {
  runId: string;
  testRunId?: string;
  row: number;
  status: string;
  type: string;
  action: string;
  code?: string | null;
  idInt?: string | number | null;
  idString?: string | null;
  mlbId?: string | null;
  pecaId?: string | null;
  messages?: string[];
  warnings?: string[];
  errors?: string[];
  raw?: unknown;
  normalized?: unknown;
  metadata: ImportTargetMetadata;
}

export interface ImportRunItemResult {
  id: string;
}

export interface InventoryMatchInput {
  storeId: string;
  idInt?: string | number | null;
  idString?: string | null;
  code?: string | null;
  tagCode?: string | null;
  identifierSearchKeys?: string[] | null;
  mlbIds?: string[] | null;
}

export interface InventoryItemMatch {
  id: string;
  raw: Document;
  matchedBy: string;
}

export interface InventoryItemResult {
  id: string;
  raw?: Document;
}

export interface StorageLocationInput {
  storeId: string;
  name: string;
}

export interface StorageLocationResult {
  id: string;
  name: string;
  raw?: Document;
}

export interface MarketplaceAdInput {
  integrationId: string;
  mlbId: string;
}

export interface MarketplaceAdResult {
  id: string;
  mlbId?: string | null;
  raw?: Document;
}

export interface PartCategoryInput {
  categoryId: string;
}

export interface PartCategoryResult {
  id: string;
  raw: Document;
}

export interface ImportWriteTarget {
  name: ImportTargetName;

  createImportRun(payload: ImportRunPayload): Promise<ImportRunResult>;
  updateImportRun(runId: string, patch: Record<string, unknown>): Promise<void>;
  createImportRunItem(payload: ImportRunItemPayload): Promise<ImportRunItemResult>;

  findInventoryItem(input: InventoryMatchInput): Promise<InventoryItemMatch | null>;
  createInventoryItem(payload: Document): Promise<InventoryItemResult>;
  updateInventoryItem(id: string, patch: Document): Promise<InventoryItemResult>;

  findStorageLocation(input: StorageLocationInput): Promise<StorageLocationResult | null>;
  createStorageLocation(payload: Document): Promise<StorageLocationResult>;

  findMarketplaceAd(input: MarketplaceAdInput): Promise<MarketplaceAdResult | null>;
  upsertMarketplaceAd(payload: Document): Promise<MarketplaceAdResult>;

  findPartCategory(input: PartCategoryInput): Promise<PartCategoryResult | null>;
}
