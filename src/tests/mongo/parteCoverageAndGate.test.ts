import { describe, expect, it } from 'vitest';
import {
  buildParteCoverageReport,
  extractMlbCategoryIdsFromRows,
} from '../../adapters/mongo/parteCoverage';
import { evaluateMongoImportQualityGate } from '../../adapters/mongo/mongoImportQualityGate';

describe('parte coverage diagnostics', () => {
  it('extracts explicit MLB category ids from rows', () => {
    const ids = extractMlbCategoryIdsFromRows([
      { MLB_categoria_id: 'MLB123' },
      { 'categoria mlb': 'MLB456' },
      { mercado_libre_brasil_category_id: 'MLB123' },
    ]);

    expect(ids).toEqual(['MLB123', 'MLB456']);
  });

  it('reports found and missing categories', async () => {
    const collection = {
      find() {
        return {
          async toArray() {
            return [{ MLB_categoria_id: 'MLB123' }];
          },
        };
      },
    };

    const report = await buildParteCoverageReport(
      collection as never,
      ['MLB123', 'MLB456'],
      2
    );

    expect(report.required).toEqual(['MLB123', 'MLB456']);
    expect(report.found).toEqual(['MLB123']);
    expect(report.missing).toEqual(['MLB456']);
    expect(report.coveragePercent).toBe(50);
  });
});

describe('mongo import quality gate', () => {
  const dryRun = {
    totalRows: 19,
    valid: 19,
    invalid: 0,
    categoriesFound: 0,
    categoriesMissing: 17,
  };

  it('allows dry run even with zero category coverage', () => {
    const gate = evaluateMongoImportQualityGate(dryRun, { write: false });
    expect(gate.allowed).toBe(true);
    expect(gate.errors).toEqual([]);
  });

  it('blocks write with zero category coverage', () => {
    const gate = evaluateMongoImportQualityGate(dryRun, { write: true });
    expect(gate.allowed).toBe(false);
    expect(gate.errors).toContain('Write bloqueado: collection parte sem cobertura suficiente.');
  });

  it('allows write with explicit category pending override', () => {
    const gate = evaluateMongoImportQualityGate(dryRun, {
      write: true,
      allowCategoryPending: true,
    });
    expect(gate.allowed).toBe(true);
    expect(gate.warnings.join(' ')).toContain('--allow-category-pending');
  });
});
