export interface MongoImportDryRunSummary {
  totalRows: number;
  valid: number;
  invalid: number;
  categoriesFound: number;
  categoriesMissing: number;
}

export interface MongoImportQualityGateResult {
  allowed: boolean;
  warnings: string[];
  errors: string[];
}

export const evaluateMongoImportQualityGate = (
  dryRun: MongoImportDryRunSummary,
  options: {
    write: boolean;
    allowCategoryPending?: boolean;
  }
): MongoImportQualityGateResult => {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!options.write) {
    return { allowed: true, warnings, errors };
  }

  if (dryRun.totalRows <= 0) {
    errors.push('Write bloqueado: arquivo sem linhas.');
  }

  if (dryRun.invalid > 0 || dryRun.valid !== dryRun.totalRows) {
    errors.push('Write bloqueado: dry run possui linhas invalidas.');
  }

  if (dryRun.categoriesFound === 0 && dryRun.categoriesMissing > 0) {
    const message = 'Write bloqueado: collection parte sem cobertura suficiente.';
    if (options.allowCategoryPending) {
      warnings.push(`${message} Override aplicado por --allow-category-pending.`);
    } else {
      errors.push(message);
    }
  }

  return {
    allowed: errors.length === 0,
    warnings,
    errors,
  };
};
