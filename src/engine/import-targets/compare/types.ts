export type ImportTargetComparisonSeverity = 'critical' | 'warning' | 'expected' | 'info';
export type ImportTargetRowStatus = 'equal' | 'critical_diff' | 'warning_diff' | 'expected_diff';

export interface ComparableImportRow {
  row: number;
  code?: string | null;
  id_int?: string | number | null;
  id_string?: string | null;
  mlb_ids?: string[];
  action: string;
  matchedBy?: string | null;
  matchedId?: string | null;
  confidence?: number | null;
  reason?: string | null;
  payload?: Record<string, unknown>;
  warnings?: string[];
}

export interface ComparableImportPlan {
  target: 'supabase' | 'mongo';
  rows: ComparableImportRow[];
  summary: {
    totalRows: number;
    creates: number;
    updates: number;
    skipped: number;
    conflicts: number;
    invalid: number;
    warnings: number;
  };
}

export interface ImportTargetDiff {
  severity: ImportTargetComparisonSeverity;
  field: string;
  supabaseValue: unknown;
  mongoValue: unknown;
  reason: string;
}

export interface ImportTargetComparisonRow {
  row: number;
  code?: string | null;
  id_int?: string | number | null;
  id_string?: string | null;
  supabaseAction: string;
  mongoAction: string;
  status: ImportTargetRowStatus;
  diffs: ImportTargetDiff[];
}

export interface ImportTargetComparisonReport {
  file: string;
  integrationId: string;
  storeId: string;
  createdAt: string;
  targets: ['supabase', 'mongo'];
  summary: {
    totalRows: number;
    equal: number;
    critical: number;
    warning: number;
    expected: number;
    info: number;
    plan?: {
      equal: number;
      critical: number;
      warning: number;
      expected: number;
      info: number;
    };
    enrichment?: EnrichmentComparisonSummary;
  };
  rows: ImportTargetComparisonRow[];
}

export interface EnrichmentAdSnapshot {
  mlbId: string;
  status: 'found' | 'no_access' | 'not_found' | 'fetch_error';
  found: boolean;
  noAccess: boolean;
  notFound: boolean;
  title: string | null;
  price: number | null;
  availableQuantity: number | null;
  categoryId: string | null;
  permalink: string | null;
  pictureCount: number;
  attributeCount: number;
  thumbnail: string | null;
  dateCreated: string | null;
  lastUpdated: string | null;
}

export interface EnrichmentComparisonSnapshot {
  targetName: 'supabase' | 'mongo';
  row: number;
  code?: string | null;
  id_int?: string | number | null;
  id_string?: string | null;
  mlb_ids: string[];
  category: {
    sourceCategoryId: string | null;
    mlCategoryId: string | null;
    finalCategoryId: string | null;
    partCategoryFound: boolean;
    partCategoryId: string | null;
    partCategoryName: string | null;
    mercadoLibreBrasilCategoryId: string | null;
    pendingReason: string | null;
  };
  catalog: {
    attributes: unknown[];
    missingRequiredAttributes: string[];
    source: string | null;
  };
  package: {
    height: number | string | null;
    width: number | string | null;
    length: number | string | null;
    weight: number | string | null;
    source: string | null;
  };
  ads: EnrichmentAdSnapshot[];
  images: {
    source: string | null;
    urls: string[];
    count: number;
  };
  warnings: string[];
}

export interface EnrichmentComparisonRow {
  row: number;
  code?: string | null;
  status: ImportTargetRowStatus;
  diffs: ImportTargetDiff[];
}

export interface EnrichmentComparisonSummary {
  equal: number;
  critical: number;
  warning: number;
  expected: number;
  info: number;
  categoryEqual: number;
  categoryPending: number;
  categoryDivergent: number;
  adFound: number;
  adNoAccess: number;
  adNotFound: number;
  imageEqual: number;
  imageDiffs: number;
  warnings: number;
}
