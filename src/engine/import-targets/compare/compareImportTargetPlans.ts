import type {
  ComparableImportPlan,
  ComparableImportRow,
  ImportTargetComparisonReport,
  ImportTargetComparisonRow,
  ImportTargetDiff,
  ImportTargetRowStatus,
} from './types';

const CRITICAL_FIELDS = new Set([
  'store_id',
  'code',
  'id_int',
  'id_string',
  'price',
  'stock_quantity',
  'status',
]);

const WARNING_FIELDS = new Set([
  'description',
  'images',
  'image_count',
  'storage_location_id',
  'storage_location_name',
  'storage_location_source',
]);

const CATEGORY_FIELDS = new Set([
  'part_category_id',
  'part_category_name',
  'mercado_libre_brasil_category_id',
  'catalog_attributes',
  'package_height',
  'package_width',
  'package_length',
  'package_weight',
  'shopee_category_id',
  'shopee_brand_id',
  'vehicle_type',
  'compatibilities_restrictions',
]);

const comparable = (value: unknown): string => JSON.stringify(value ?? null);

const diffStatus = (diffs: ImportTargetDiff[]): ImportTargetRowStatus => {
  if (diffs.some((diff) => diff.severity === 'critical')) return 'critical_diff';
  if (diffs.some((diff) => diff.severity === 'warning')) return 'warning_diff';
  if (diffs.some((diff) => diff.severity === 'expected')) return 'expected_diff';
  return 'equal';
};

const classifyPayloadDiff = (
  field: string,
  supabaseRow: ComparableImportRow,
  mongoRow: ComparableImportRow
): ImportTargetDiff | null => {
  const supabaseValue = supabaseRow.payload?.[field] ?? null;
  const mongoValue = mongoRow.payload?.[field] ?? null;
  if (comparable(supabaseValue) === comparable(mongoValue)) return null;

  if (CATEGORY_FIELDS.has(field) && (mongoValue === null || mongoValue === undefined)) {
    return {
      severity: 'expected',
      field,
      supabaseValue,
      mongoValue,
      reason: 'expected_reference_gap: Mongo de teste sem referencia em parte.',
    };
  }

  if (field === 'storage_location_id') {
    const sameName = comparable(supabaseRow.payload?.storage_location_name) === comparable(mongoRow.payload?.storage_location_name);
    return {
      severity: sameName ? 'expected' : 'warning',
      field,
      supabaseValue,
      mongoValue,
      reason: sameName
        ? 'ids diferentes entre bancos para a mesma localizacao.'
        : 'localizacao divergente entre targets.',
    };
  }

  if (CRITICAL_FIELDS.has(field)) {
    return {
      severity: 'critical',
      field,
      supabaseValue,
      mongoValue,
      reason: `Campo critico divergente: ${field}.`,
    };
  }

  if (WARNING_FIELDS.has(field)) {
    return {
      severity: 'warning',
      field,
      supabaseValue,
      mongoValue,
      reason: `Campo nao critico divergente: ${field}.`,
    };
  }

  return {
    severity: 'info',
    field,
    supabaseValue,
    mongoValue,
    reason: `Campo informativo divergente: ${field}.`,
  };
};

const compareRows = (
  supabaseRow: ComparableImportRow,
  mongoRow: ComparableImportRow
): ImportTargetComparisonRow => {
  const diffs: ImportTargetDiff[] = [];

  if (supabaseRow.action !== mongoRow.action) {
    diffs.push({
      severity: 'critical',
      field: 'action',
      supabaseValue: supabaseRow.action,
      mongoValue: mongoRow.action,
      reason: 'Targets planejaram acoes diferentes para a mesma linha.',
    });
  }

  if (supabaseRow.matchedBy !== mongoRow.matchedBy && (supabaseRow.action === 'update' || mongoRow.action === 'update')) {
    diffs.push({
      severity: 'critical',
      field: 'matchedBy',
      supabaseValue: supabaseRow.matchedBy,
      mongoValue: mongoRow.matchedBy,
      reason: 'Divergencia de match em linha com update.',
    });
  }

  const payloadFields = new Set([
    ...Object.keys(supabaseRow.payload ?? {}),
    ...Object.keys(mongoRow.payload ?? {}),
  ]);
  for (const field of payloadFields) {
    const diff = classifyPayloadDiff(field, supabaseRow, mongoRow);
    if (diff) diffs.push(diff);
  }

  const supabaseWarnings = new Set(supabaseRow.warnings ?? []);
  const mongoWarnings = new Set(mongoRow.warnings ?? []);
  for (const warning of new Set([...supabaseWarnings, ...mongoWarnings])) {
    if (supabaseWarnings.has(warning) && mongoWarnings.has(warning)) continue;
    const expectedCategoryGap = warning.includes('category_pending');
    diffs.push({
      severity: expectedCategoryGap ? 'expected' : 'warning',
      field: 'warnings',
      supabaseValue: supabaseRow.warnings,
      mongoValue: mongoRow.warnings,
      reason: expectedCategoryGap
        ? 'expected_reference_gap: category_pending por referencia ausente.'
        : 'Warnings divergentes entre targets.',
    });
  }

  return {
    row: supabaseRow.row,
    code: supabaseRow.code ?? mongoRow.code ?? null,
    id_int: supabaseRow.id_int ?? mongoRow.id_int ?? null,
    id_string: supabaseRow.id_string ?? mongoRow.id_string ?? null,
    supabaseAction: supabaseRow.action,
    mongoAction: mongoRow.action,
    status: diffStatus(diffs),
    diffs,
  };
};

export const compareImportTargetPlans = (input: {
  file: string;
  integrationId: string;
  storeId: string;
  supabase: ComparableImportPlan;
  mongo: ComparableImportPlan;
  createdAt?: string;
}): ImportTargetComparisonReport => {
  const mongoByRow = new Map(input.mongo.rows.map((row) => [row.row, row]));
  const rows = input.supabase.rows.map((supabaseRow) => {
    const mongoRow = mongoByRow.get(supabaseRow.row);
    if (!mongoRow) {
      return {
        row: supabaseRow.row,
        code: supabaseRow.code,
        id_int: supabaseRow.id_int,
        id_string: supabaseRow.id_string,
        supabaseAction: supabaseRow.action,
        mongoAction: 'missing',
        status: 'critical_diff' as const,
        diffs: [{
          severity: 'critical' as const,
          field: 'row',
          supabaseValue: supabaseRow.row,
          mongoValue: null,
          reason: 'Linha ausente no plano Mongo.',
        }],
      };
    }
    return compareRows(supabaseRow, mongoRow);
  });

  const allDiffs = rows.flatMap((row) => row.diffs);
  return {
    file: input.file,
    integrationId: input.integrationId,
    storeId: input.storeId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    targets: ['supabase', 'mongo'],
    summary: {
      totalRows: rows.length,
      equal: rows.filter((row) => row.status === 'equal').length,
      critical: allDiffs.filter((diff) => diff.severity === 'critical').length,
      warning: allDiffs.filter((diff) => diff.severity === 'warning').length,
      expected: allDiffs.filter((diff) => diff.severity === 'expected').length,
      info: allDiffs.filter((diff) => diff.severity === 'info').length,
      plan: {
        equal: rows.filter((row) => row.status === 'equal').length,
        critical: allDiffs.filter((diff) => diff.severity === 'critical').length,
        warning: allDiffs.filter((diff) => diff.severity === 'warning').length,
        expected: allDiffs.filter((diff) => diff.severity === 'expected').length,
        info: allDiffs.filter((diff) => diff.severity === 'info').length,
      },
    },
    rows,
  };
};

export const getComparisonExitCode = (
  report: Pick<ImportTargetComparisonReport, 'summary'>
): 0 | 1 =>
  report.summary.critical > 0 || (report.summary.enrichment?.critical ?? 0) > 0 ? 1 : 0;
