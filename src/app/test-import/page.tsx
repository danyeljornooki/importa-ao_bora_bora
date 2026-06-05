'use client'

import React, { useState } from 'react';
import { ImportPlan, ImportActionType } from '../../modules/importer/planner/buildImportPlan';
import type { PartCanonical } from '../../modules/importer/schemas/part.schema';
import type { MatchAction, MatchSource } from '../../modules/importer/matchers/matchPart';
import type { PartChange } from '../../modules/importer/comparators/comparePart';
import type { MatchingStats } from '../../services/importEngine';
import type { ExecutionPlan } from '../../planners/buildExecutionPlan';
import { persistExecutionPlan } from '../../modules/importer/persistence/persistExecutionPlan';

interface PreviewItem {
  row: number;
  valid: boolean;
  action?: MatchAction;
  matchedBy?: MatchSource;
  confidence?: number;
  changed: boolean;
  totalChanges: number;
  changes: PartChange[];
  importAction?: ImportActionType;
  reason?: string;
  data?: PartCanonical;
  errors: string[];
  warnings: string[];
}


export default function TestImportPage() {
  const [sheetName, setSheetName] = useState<string>('');
  const [rowsCount, setRowsCount] = useState<number>(0);
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [validCount, setValidCount] = useState<number>(0);
  const [invalidCount, setInvalidCount] = useState<number>(0);
  const [warningsCount, setWarningsCount] = useState<number>(0);
  const [createsCount, setCreatesCount] = useState<number>(0);
  const [updatesCount, setUpdatesCount] = useState<number>(0);
  const [conflictsCount, setConflictsCount] = useState<number>(0);
  const [skippedCount, setSkippedCount] = useState<number>(0);
  const [changedUpdatesCount, setChangedUpdatesCount] = useState<number>(0);
  const [unchangedUpdatesCount, setUnchangedUpdatesCount] = useState<number>(0);
  const [importPlan, setImportPlan] = useState<ImportPlan | null>(null);
  const [matchingStats, setMatchingStats] = useState<MatchingStats | null>(null);
  const [executionPlan, setExecutionPlan] = useState<ExecutionPlan | null>(null);
  const [persistResult, setPersistResult] = useState<{
    total: number;
    created: number;
    updated: number;
    skipped: number;
    conflicts?: number;
    invalid?: number;
    failed: number;
    errors: Array<{ row?: number; reason: string; payload?: unknown; targetId?: string }>;
  } | null>(null);
  const [persistLoading, setPersistLoading] = useState<boolean>(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [persistProgress, setPersistProgress] = useState<number>(0);
  const [existingPartsCount, setExistingPartsCount] = useState<number>(0);
  const [storeId, setStoreId] = useState<string>('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (storeId.trim() === '') {
      setError('storeId obrigatorio para executar a engine oficial.');
      return;
    }

    setError(null);
    setLoading(true);
    setPreview([]);
    setSheetName('');
    setRowsCount(0);
    setValidCount(0);
    setInvalidCount(0);
    setWarningsCount(0);
    setCreatesCount(0);
    setUpdatesCount(0);
    setConflictsCount(0);
    setSkippedCount(0);
    setChangedUpdatesCount(0);
    setUnchangedUpdatesCount(0);
    setMatchingStats(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const { runImport } = await import('../../services/importEngine');
      const result = await runImport(arrayBuffer, { storeId: storeId.trim(), debugMatching: true });

      setSheetName(result.sheetName);
      setRowsCount(result.totalRows);
      setImportPlan(result.importPlan);
      if (result.matchingStats) {
        setMatchingStats(result.matchingStats);
        setExistingPartsCount(result.matchingStats.existingPartsCount);
      }

      // enriched preview is already limited by service
      const enrichedPreview = result.previewItems.map((item: any) => ({
        ...item,
        importAction: result.importPlan.actions.find((a) => a.row === item.row)?.type,
        reason: result.importPlan.actions.find((a) => a.row === item.row)?.reason,
      }));

      setValidCount(result.summary.valid);
      setInvalidCount(result.summary.invalid);
      setWarningsCount(result.summary.warnings);
      setCreatesCount(result.summary.creates);
      setUpdatesCount(result.summary.updates);
      setConflictsCount(result.summary.conflicts);
      setSkippedCount(result.summary.skipped);
      setChangedUpdatesCount(result.summary.updates - result.summary.unchangedUpdates);
      setUnchangedUpdatesCount(result.summary.unchangedUpdates);

      setPreview(enrichedPreview as PreviewItem[]);
      setExecutionPlan(result.executionPlan);
      setPersistResult(null);
      setPersistError(null);
      setPersistProgress(0);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: 16, fontFamily: 'Arial, sans-serif' }}>
      <h1>Test Import</h1>

      <div style={{ marginBottom: 16, padding: 12, border: '1px solid #ddd', borderRadius: 4 }}>
        <h2 style={{ marginTop: 0 }}>Upload Configuration</h2>

        <label style={{ display: 'block', marginBottom: 12 }}>
          Store ID (Supabase)
          <input
            type="text"
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
            placeholder="store_id"
            style={{ display: 'block', marginTop: 8, width: 320, maxWidth: '100%' }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 8 }}>
          Arquivo de importação
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            style={{ display: 'block', marginTop: 8 }}
          />
        </label>
      </div>

      {loading && <div>Loading...</div>}

      {error && (
        <div style={{ color: 'red', whiteSpace: 'pre-wrap' }}>Error: {error}</div>
      )}

      <div style={{ marginTop: 12, padding: 12, border: '1px solid #e6e6ff', borderRadius: 4, backgroundColor: '#f9f9ff' }}>
        <h3>Existing Dataset</h3>
        <div>Source: Supabase</div>
        <div>Count: {existingPartsCount}</div>
        {existingPartsCount > 0 && existingPartsCount < 100 && (
          <div style={{ color: '#ff6b00', marginTop: 8 }}>
            ⚠️ Dataset de existingParts muito pequeno para teste real.
          </div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <div>Sheet Name: {sheetName || '-'}</div>
        <div>Rows: {rowsCount}</div>
        <div>
          Total: {importPlan ? importPlan.summary.total : rowsCount}
        </div>
        <div>Creates: {importPlan ? importPlan.summary.creates : createsCount}</div>
        <div>Updates: {importPlan ? importPlan.summary.updates : updatesCount}</div>
        <div>Unchanged Updates: {importPlan ? importPlan.summary.unchangedUpdates : unchangedUpdatesCount}</div>
        <div>Conflicts: {importPlan ? importPlan.summary.conflicts : conflictsCount}</div>
        <div>Skipped: {importPlan ? importPlan.summary.skipped : skippedCount}</div>
        <div>Invalid: {importPlan ? importPlan.summary.invalid : invalidCount}</div>
      </div>

      {executionPlan && (
        <div style={{ marginTop: 16, padding: 12, border: '1px solid #ddd', borderRadius: 4, backgroundColor: '#f3f7ff' }}>
          <button
            type="button"
            disabled={persistLoading}
            onClick={async () => {
              setPersistError(null);
              setPersistResult(null);
              setPersistLoading(true);
              setPersistProgress(0);
              try {
                const result = await persistExecutionPlan(executionPlan, {
                  onProgress: (progress) => setPersistProgress(progress),
                });
                setPersistResult(result);
              } catch (err: any) {
                setPersistError(err?.message ?? String(err));
              } finally {
                setPersistLoading(false);
              }
            }}
            style={{ padding: '10px 16px', fontSize: 14, cursor: persistLoading ? 'not-allowed' : 'pointer' }}
          >
            {persistLoading ? 'Executando importação...' : 'Executar Importação'}
          </button>

          {persistLoading && (
            <div style={{ marginTop: 8 }}>Progresso: {persistProgress}%</div>
          )}

          {persistError && (
            <div style={{ color: 'red', marginTop: 8 }}>Erro: {persistError}</div>
          )}

          {persistResult && (
            <div style={{ marginTop: 12 }}>
              <div>Created: {persistResult.created}</div>
              <div>Updated: {persistResult.updated}</div>
              <div>Skipped: {persistResult.skipped}</div>
              <div>Failed: {persistResult.failed}</div>
              {persistResult.errors.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong>Errors</strong>
                  <pre style={{ maxHeight: 220, overflow: 'auto', background: '#fff3cd', padding: 8, fontSize: 12 }}>
{JSON.stringify(persistResult.errors.slice(0, 20), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {matchingStats && (
        <div style={{ marginTop: 12, border: '1px solid #ccc', padding: 12 }}>
          <h2>Matching Stats</h2>
          <div>Existing Parts: {matchingStats.existingPartsCount}</div>
          <div>Total Rows: {matchingStats.totalRows}</div>
          {matchingStats.existingPartsIdentifierStats && (
            <div style={{ marginTop: 8 }}>
              <div>missing_id_int: {matchingStats.existingPartsIdentifierStats.missing_id_int}</div>
              <div>missing_code: {matchingStats.existingPartsIdentifierStats.missing_code}</div>
              <div>missing_id_string: {matchingStats.existingPartsIdentifierStats.missing_id_string}</div>
            </div>
          )}

          {/* Match Rate and warnings */}
          {(() => {
            const matchedCount = matchingStats.matchedBy.id_int + matchingStats.matchedBy.code + matchingStats.matchedBy.mlb_id + matchingStats.matchedBy.title;
            const matchRate = matchingStats.totalRows > 0 ? (matchedCount / matchingStats.totalRows) * 100 : 0;
            return (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 'bold', fontSize: 16 }}>Match Rate: {matchRate.toFixed(2)}%</div>
                {matchRate < 5 && (
                  <div style={{ color: '#ff6b00', marginTop: 6 }}>⚠️ Taxa de match baixa — possível divergência de identificadores.</div>
                )}
              </div>
            );
          })()}

          {/* Miss Breakdown */}
          <div style={{ marginTop: 12 }}>
            <strong>Miss Breakdown</strong>
            <div>id_int failed: {matchingStats.failedByIdentifierCount?.id_int ?? (matchingStats.failedByIdentifierCount ? matchingStats.failedByIdentifierCount.id_int : 0)}</div>
            <div>code failed: {matchingStats.failedByIdentifierCount?.code ?? (matchingStats.failedByIdentifierCount ? matchingStats.failedByIdentifierCount.code : 0)}</div>
            <div>mlb_id failed: {matchingStats.failedByIdentifierCount?.mlb_id ?? (matchingStats.failedByIdentifierCount ? matchingStats.failedByIdentifierCount.mlb_id : 0)}</div>
          </div>

          {/* Top missing lists */}
          <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
            <div style={{ minWidth: 220 }}>
              <strong>Top Missing MLBs</strong>
              <div style={{ marginTop: 6 }}>
                {matchingStats.topMissingCodes && matchingStats.topMissingCodes.length > 0 ? (
                  matchingStats.topMissingCodes
                    .filter((c) => typeof c.code === 'string' && /^mlb/i.test(c.code))
                    .slice(0, 10)
                    .map((c) => (
                      <div key={c.code} style={{ lineHeight: '1.4' }}>{c.code} ({c.count}x)</div>
                    ))
                ) : (
                  <div style={{ color: '#666' }}>—</div>
                )}
              </div>
            </div>

            <div style={{ minWidth: 220 }}>
              <strong>Top Missing id_int</strong>
              <div style={{ marginTop: 6 }}>
                {matchingStats.topMissingCodes && matchingStats.topMissingCodes.length > 0 ? (
                  matchingStats.topMissingCodes
                    .filter((c) => /^[0-9]+$/.test(String(c.code)))
                    .slice(0, 10)
                    .map((c) => (
                      <div key={c.code} style={{ lineHeight: '1.4' }}>{c.code} ({c.count}x)</div>
                    ))
                ) : (
                  <div style={{ color: '#666' }}>—</div>
                )}
              </div>
            </div>
          </div>

          {/* Top miss examples */}
          {matchingStats.topMissExamples && matchingStats.topMissExamples.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <strong>Top Miss Examples (up to 20)</strong>
              <pre style={{ maxHeight: 300, overflow: 'auto', background: '#fff3cd', padding: 8, fontSize: 12 }}>
{JSON.stringify(matchingStats.topMissExamples, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <h2>Preview (first 20)</h2>
        <pre style={{ maxHeight: 400, overflow: 'auto', background: '#f6f6f6', padding: 12 }}>
{JSON.stringify(preview, null, 2)}
        </pre>
      </div>
    </main>
  );
}
