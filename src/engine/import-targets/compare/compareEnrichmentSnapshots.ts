import type {
  EnrichmentComparisonRow,
  EnrichmentComparisonSnapshot,
  EnrichmentComparisonSummary,
  ImportTargetDiff,
  ImportTargetRowStatus,
} from './types';

const stable = (value: unknown): string => JSON.stringify(value ?? null);

const statusFrom = (diffs: ImportTargetDiff[]): ImportTargetRowStatus => {
  if (diffs.some((diff) => diff.severity === 'critical')) return 'critical_diff';
  if (diffs.some((diff) => diff.severity === 'warning')) return 'warning_diff';
  if (diffs.some((diff) => diff.severity === 'expected')) return 'expected_diff';
  return 'equal';
};

const compareField = (
  diffs: ImportTargetDiff[],
  field: string,
  supabaseValue: unknown,
  mongoValue: unknown,
  severity: ImportTargetDiff['severity'],
  reason: string
) => {
  if (stable(supabaseValue) !== stable(mongoValue)) {
    diffs.push({ field, supabaseValue, mongoValue, severity, reason });
  }
};

export const compareEnrichmentSnapshots = (
  supabase: EnrichmentComparisonSnapshot[],
  mongo: EnrichmentComparisonSnapshot[]
): { rows: EnrichmentComparisonRow[]; summary: EnrichmentComparisonSummary } => {
  const mongoByRow = new Map(mongo.map((item) => [item.row, item]));
  const rows = supabase.map((supabaseRow): EnrichmentComparisonRow => {
    const mongoRow = mongoByRow.get(supabaseRow.row);
    const diffs: ImportTargetDiff[] = [];
    if (!mongoRow) {
      return {
        row: supabaseRow.row,
        code: supabaseRow.code,
        status: 'critical_diff',
        diffs: [{
          severity: 'critical',
          field: 'row',
          supabaseValue: supabaseRow.row,
          mongoValue: null,
          reason: 'Snapshot de enrichment ausente no Mongo.',
        }],
      };
    }

    compareField(diffs, 'code', supabaseRow.code, mongoRow.code, 'critical', 'Code divergente no enrichment.');
    compareField(diffs, 'id_int', supabaseRow.id_int, mongoRow.id_int, 'critical', 'id_int divergente no enrichment.');
    compareField(diffs, 'id_string', supabaseRow.id_string, mongoRow.id_string, 'critical', 'id_string divergente no enrichment.');

    const mongoCategoryGap = !mongoRow.category.partCategoryFound && mongoRow.warnings.some((warning) => warning.includes('category_pending'));
    compareField(
      diffs,
      'category.finalCategoryId',
      supabaseRow.category.finalCategoryId,
      mongoRow.category.finalCategoryId,
      mongoCategoryGap ? 'expected' : 'critical',
      mongoCategoryGap
        ? 'expected_reference_gap: Mongo sem parte populada.'
        : 'Categoria final divergente entre targets.'
    );
    compareField(
      diffs,
      'category.partCategoryName',
      supabaseRow.category.partCategoryName,
      mongoRow.category.partCategoryName,
      mongoCategoryGap ? 'expected' : 'critical',
      mongoCategoryGap
        ? 'expected_reference_gap: Mongo sem parte populada.'
        : 'Parte/categoria interna divergente entre targets.'
    );

    compareField(diffs, 'catalog.attributes', supabaseRow.catalog.attributes, mongoRow.catalog.attributes, mongoCategoryGap ? 'expected' : 'warning', 'Atributos de catalogo divergentes.');
    compareField(diffs, 'package', supabaseRow.package, mongoRow.package, mongoCategoryGap ? 'expected' : 'warning', 'Medidas/peso divergentes.');
    compareField(diffs, 'images.urls', supabaseRow.images.urls, mongoRow.images.urls, 'warning', 'Imagens divergentes.');

    const supAds = new Map(supabaseRow.ads.map((ad) => [ad.mlbId, ad]));
    const mongoAds = new Map(mongoRow.ads.map((ad) => [ad.mlbId, ad]));
    for (const mlbId of new Set([...supAds.keys(), ...mongoAds.keys()])) {
      const a = supAds.get(mlbId);
      const b = mongoAds.get(mlbId);
      compareField(diffs, `ads.${mlbId}.status`, a?.status, b?.status, 'warning', 'Status de leitura do anuncio divergente.');
      compareField(diffs, `ads.${mlbId}.categoryId`, a?.categoryId, b?.categoryId, 'warning', 'Categoria do snapshot ML divergente.');
      compareField(diffs, `ads.${mlbId}.price`, a?.price, b?.price, 'warning', 'Preco do snapshot ML divergente.');
    }

    for (const warning of new Set([...supabaseRow.warnings, ...mongoRow.warnings])) {
      if (supabaseRow.warnings.includes(warning) && mongoRow.warnings.includes(warning)) continue;
      const expected = warning.includes('category_pending') && mongoCategoryGap;
      diffs.push({
        severity: expected ? 'expected' : 'warning',
        field: 'warnings',
        supabaseValue: supabaseRow.warnings,
        mongoValue: mongoRow.warnings,
        reason: expected ? 'expected_reference_gap: warning de categoria pendente.' : 'Warnings de enrichment divergentes.',
      });
    }

    return {
      row: supabaseRow.row,
      code: supabaseRow.code,
      status: statusFrom(diffs),
      diffs,
    };
  });

  const allDiffs = rows.flatMap((row) => row.diffs);
  const allSnapshots = [...supabase, ...mongo];
  const summary: EnrichmentComparisonSummary = {
    equal: rows.filter((row) => row.status === 'equal').length,
    critical: allDiffs.filter((diff) => diff.severity === 'critical').length,
    warning: allDiffs.filter((diff) => diff.severity === 'warning').length,
    expected: allDiffs.filter((diff) => diff.severity === 'expected').length,
    info: allDiffs.filter((diff) => diff.severity === 'info').length,
    categoryEqual: rows.filter((row) => !row.diffs.some((diff) => diff.field.startsWith('category.'))).length,
    categoryPending: allSnapshots.filter((item) => item.warnings.some((warning) => warning.includes('category_pending'))).length,
    categoryDivergent: rows.filter((row) => row.diffs.some((diff) => diff.field.startsWith('category.'))).length,
    adFound: allSnapshots.reduce((total, item) => total + item.ads.filter((ad) => ad.found).length, 0),
    adNoAccess: allSnapshots.reduce((total, item) => total + item.ads.filter((ad) => ad.noAccess).length, 0),
    adNotFound: allSnapshots.reduce((total, item) => total + item.ads.filter((ad) => ad.notFound).length, 0),
    imageEqual: rows.filter((row) => !row.diffs.some((diff) => diff.field === 'images.urls')).length,
    imageDiffs: rows.filter((row) => row.diffs.some((diff) => diff.field === 'images.urls')).length,
    warnings: allSnapshots.reduce((total, item) => total + item.warnings.length, 0),
  };

  return { rows, summary };
};
