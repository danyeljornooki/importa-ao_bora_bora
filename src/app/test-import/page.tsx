'use client'

import React, { useState } from 'react';
import { AppNavigation } from '../../components/AppNavigation';
import { ImportPlan, ImportActionType } from '../../modules/importer/planner/buildImportPlan';
import type { PartCanonical } from '../../modules/importer/schemas/part.schema';
import type { MatchSource } from '../../modules/importer/matchers/matchPart';
import type { PartChange } from '../../modules/importer/comparators/comparePart';
import type { MatchingStats } from '../../services/importEngine';
import type { ConflictDetail, RunImportResult } from '../../engine/runImport';
import { runImport } from '../../engine/runImport';
import {
  executeImportWithHistory,
  type ExecuteImportWithHistoryResult,
} from '../../engine/executeImportWithHistory';
import { supabaseImportHistoryAdapter } from '../../adapters/supabase/supabaseImportHistoryAdapter';
import { supabaseInventoryAdapter } from '../../adapters/supabase/supabaseInventoryAdapter';
import { supabaseStorageLocationAdapter } from '../../adapters/supabase/supabaseStorageLocationAdapter';

interface PreviewItem {
  row: number;
  valid: boolean;
  action?: ImportActionType;
  matchedBy?: MatchSource;
  confidence?: number;
  changed: boolean;
  totalChanges: number;
  changes: PartChange[];
  importAction?: ImportActionType;
  reason?: string;
  data?: PartCanonical;
  conflictDetails?: ConflictDetail;
  errors: string[];
  warnings: string[];
}

interface CompareDebugUpdate {
  row: number;
  matchedBy: MatchSource;
  totalChanges: number;
  changes: PartChange[];
}

interface PendingItem {
  row: number;
  type: 'conflict' | 'invalid';
  reason: string;
  code: string | null;
  idInt: string | number | null;
  mlbId: string | null;
  title: string | null;
  conflictDetails?: ConflictDetail;
  errors: string[];
  technicalDetails: unknown;
}

const firstMlbId = (part?: PartCanonical): string | null => {
  if (Array.isArray(part?.mlb_ids) && part.mlb_ids.length > 0) {
    return part.mlb_ids[0] ?? null;
  }

  return part?.id_string ?? null;
};

const buildPendingItems = (result: RunImportResult | null): PendingItem[] => {
  if (!result) return [];

  const previewItems = result.previewItems as PreviewItem[];
  const previewByRow = new Map(previewItems.map((item) => [item.row, item]));
  const conflictByRow = new Map(
    result.conflictDetails
      .filter((detail) => detail.finalAction === 'conflict')
      .map((detail) => [detail.imported.row, detail])
  );
  const pendingByRow = new Map<number, PendingItem>();

  for (const action of result.importPlan.actions) {
    if (action.type !== 'conflict' && action.type !== 'invalid') continue;

    const previewItem = previewByRow.get(action.row);
    const conflictDetails = previewItem?.conflictDetails ?? conflictByRow.get(action.row);
    const data = previewItem?.data;
    const errors = previewItem?.errors ?? [];
    const reason = errors.length > 0
      ? errors.join(', ')
      : previewItem?.reason ?? action.reason;

    pendingByRow.set(action.row, {
      row: action.row,
      type: action.type,
      reason,
      code: data?.code ?? conflictDetails?.imported.code ?? null,
      idInt: data?.id_int ?? conflictDetails?.imported.id_int ?? null,
      mlbId: firstMlbId(data) ?? conflictDetails?.imported.mlb_id ?? null,
      title: data?.title ?? conflictDetails?.imported.title ?? null,
      conflictDetails,
      errors,
      technicalDetails: {
        action,
        previewItem: previewItem ?? null,
        conflictDetails: conflictDetails ?? null,
      },
    });
  }

  for (const previewItem of previewItems) {
    const isBlocking =
      previewItem.valid === false ||
      previewItem.action === 'conflict' ||
      previewItem.action === 'invalid' ||
      previewItem.importAction === 'conflict' ||
      previewItem.importAction === 'invalid';

    if (!isBlocking || pendingByRow.has(previewItem.row)) continue;

    const type = previewItem.action === 'conflict' || previewItem.importAction === 'conflict'
      ? 'conflict'
      : 'invalid';
    const errors = previewItem.errors ?? [];

    pendingByRow.set(previewItem.row, {
      row: previewItem.row,
      type,
      reason: errors.length > 0
        ? errors.join(', ')
        : previewItem.reason ?? 'linha pendente',
      code: previewItem.data?.code ?? null,
      idInt: previewItem.data?.id_int ?? null,
      mlbId: firstMlbId(previewItem.data),
      title: previewItem.data?.title ?? null,
      conflictDetails: previewItem.conflictDetails,
      errors,
      technicalDetails: previewItem,
    });
  }

  return Array.from(pendingByRow.values()).sort((a, b) => a.row - b.row);
};

export default function TestImportPage() {
  const [sheetName, setSheetName] = useState<string>('');
  const [rowsCount, setRowsCount] = useState<number>(0);
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
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
  const [analysisResult, setAnalysisResult] = useState<RunImportResult | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecuteImportWithHistoryResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [hasAnalyzed, setHasAnalyzed] = useState<boolean>(false);
  const [hasExecuted, setHasExecuted] = useState<boolean>(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [persistProgress, setPersistProgress] = useState<number>(0);
  const [existingPartsCount, setExistingPartsCount] = useState<number>(0);
  const [storeId, setStoreId] = useState<string>('');
  const [compareDebugUpdates, setCompareDebugUpdates] = useState<CompareDebugUpdate[]>([]);
  const [conflictDetails, setConflictDetails] = useState<ConflictDetail[]>([]);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const applyImportResult = (result: RunImportResult) => {
    setSheetName(result.sheetName);
    setRowsCount(result.totalRows);
    setImportPlan(result.importPlan);
    if (result.matchingStats) {
      setMatchingStats(result.matchingStats);
      setExistingPartsCount(result.matchingStats.existingPartsCount);
    }

    const enrichedPreview = result.previewItems.map((item: PreviewItem) => ({
      ...item,
      importAction: result.importPlan.actions.find((action) => action.row === item.row)?.type,
      reason: result.importPlan.actions.find((action) => action.row === item.row)?.reason,
    }));

    setValidCount(result.summary.valid);
    setInvalidCount(result.summary.invalid);
    setWarningsCount(result.summary.warnings);
    setCreatesCount(result.summary.creates);
    setUpdatesCount(result.summary.updates);
    setConflictsCount(result.summary.conflicts);
    setSkippedCount(result.summary.skipped);
    const changedUpdates = result.importPlan.actions.filter(
      (action) => action.type === 'update'
    ).length;
    setChangedUpdatesCount(Math.max(0, changedUpdates));
    setUnchangedUpdatesCount(result.summary.unchangedUpdates);
    setPreview(enrichedPreview);
    setCompareDebugUpdates(result.compareDebugUpdates as CompareDebugUpdate[]);
    setConflictDetails(result.conflictDetails);
  };

  const clearImportFlow = () => {
    setAnalysisResult(null);
    setExecutionResult(null);
    setHasAnalyzed(false);
    setHasExecuted(false);
    setError(null);
    setPersistError(null);
    setPersistProgress(0);
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
    setImportPlan(null);
    setMatchingStats(null);
    setExistingPartsCount(0);
    setCompareDebugUpdates([]);
    setConflictDetails([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSelectedFile(file ?? null);
    clearImportFlow();
  };

  const handleAnalyze = async () => {
    if (!selectedFile || storeId.trim() === '') {
      setError('Selecione a planilha e informe o storeId antes de analisar.');
      return;
    }

    setError(null);
    setPersistError(null);
    setIsAnalyzing(true);
    setHasAnalyzed(false);
    setHasExecuted(false);
    setExecutionResult(null);

    try {
      const fileBuffer = await selectedFile.arrayBuffer();
      const result = await runImport(fileBuffer, {
        storeId: storeId.trim(),
        adapter: supabaseInventoryAdapter,
        fileName: selectedFile.name,
        debugMatching: true,
        storageLocationAdapter: supabaseStorageLocationAdapter,
      });

      setAnalysisResult(result);
      applyImportResult(result);
      setHasAnalyzed(true);
    } catch (err: unknown) {
      setAnalysisResult(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const pendingItems = buildPendingItems(analysisResult);
  const visiblePendingItems = pendingItems.slice(0, 20);
  const executableActionsCount = analysisResult
    ? analysisResult.importPlan.summary.creates + analysisResult.importPlan.summary.updates
    : 0;
  const executionBlocked = !analysisResult || executableActionsCount === 0;

  return (
    <main style={{ padding: 16, fontFamily: 'Arial, sans-serif' }}>
      <AppNavigation />
      <h1>Test Import</h1>

      <div style={{ marginBottom: 16, padding: 12, border: '1px solid #ddd', borderRadius: 4 }}>
        <h2 style={{ marginTop: 0 }}>Upload Configuration</h2>

        <label style={{ display: 'block', marginBottom: 12 }}>
          Store ID (Supabase)
          <input
            type="text"
            value={storeId}
            disabled={isAnalyzing || isExecuting}
            onChange={(event) => {
              setStoreId(event.target.value);
              clearImportFlow();
            }}
            placeholder="store_id"
            style={{ display: 'block', marginTop: 8, width: 320, maxWidth: '100%' }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 8 }}>
          Arquivo de importação
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={isAnalyzing || isExecuting}
            onChange={handleFileChange}
            style={{ display: 'block', marginTop: 8 }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <input
            type="checkbox"
            checked={debugMode}
            onChange={(event) => setDebugMode(event.target.checked)}
          />
          Mostrar debug avançado
        </label>
      </div>

      {error && (
        <div style={{ color: 'red', whiteSpace: 'pre-wrap' }}>Error: {error}</div>
      )}

      <div style={{ marginTop: 12, padding: 12, border: '1px solid #e6e6ff', borderRadius: 4, backgroundColor: '#f9f9ff' }}>
        <h3>Existing Dataset</h3>
        <div>Source: Supabase</div>
        <div>Count: {existingPartsCount}</div>
        {existingPartsCount < 100 && (
          <div style={{ color: '#ff6b00', marginTop: 8 }}>
            Base de comparação pequena. Resultado útil para teste funcional, mas não para validação real de match.
          </div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        {hasAnalyzed && !hasExecuted && (
          <div style={{ marginBottom: 8, fontWeight: 'bold' }}>Modo: Dry Run</div>
        )}
        {hasExecuted && (
          <div style={{ marginBottom: 8, fontWeight: 'bold' }}>Modo: Commit executado</div>
        )}
        <div>Sheet Name: {sheetName || '-'}</div>
        <div>Rows: {rowsCount}</div>
        <div>
          Total: {importPlan ? importPlan.summary.total : rowsCount}
        </div>
        <div>Creates: {importPlan ? importPlan.summary.creates : createsCount}</div>
        <div>Updates: {importPlan ? importPlan.summary.updates : updatesCount}</div>
        <div>Skipped: {importPlan ? importPlan.summary.skipped : skippedCount}</div>
        <div>Conflicts: {importPlan ? importPlan.summary.conflicts : conflictsCount}</div>
        <div>Invalid: {importPlan ? importPlan.summary.invalid : invalidCount}</div>
        <div>Warnings: {warningsCount}</div>
      </div>

      {selectedFile && (
        <div style={{ marginTop: 16, padding: 12, border: '1px solid #ddd', borderRadius: 4, backgroundColor: '#f3f7ff' }}>
          <button
            type="button"
            disabled={isAnalyzing || isExecuting || hasExecuted}
            onClick={handleAnalyze}
            style={{
              padding: '10px 16px',
              marginRight: 8,
              fontSize: 14,
              cursor: isAnalyzing || isExecuting || hasExecuted ? 'not-allowed' : 'pointer',
            }}
          >
            {isAnalyzing ? 'Analisando...' : 'Analisar Planilha'}
          </button>

          {pendingItems.length > 0 && (
            <div
              style={{
                marginTop: 16,
                marginBottom: 16,
                padding: 12,
                border: '1px solid #d97706',
                borderRadius: 4,
                backgroundColor: '#fffbeb',
              }}
            >
              <h2 style={{ marginTop: 0 }}>Pendências não importadas</h2>
              <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
                A importação será parcial. Linhas com conflito ou inválidas não serão cadastradas.
              </div>
              <div style={{ marginBottom: 12 }}>
                {pendingItems.length} {pendingItems.length === 1 ? 'linha será ignorada' : 'linhas serão ignoradas'}:{' '}
                {conflictsCount} {conflictsCount === 1 ? 'conflito' : 'conflitos'},{' '}
                {invalidCount} {invalidCount === 1 ? 'inválida' : 'inválidas'}.
              </div>
              <div style={{ marginBottom: 12 }}>
                Algumas linhas serão ignoradas e ficarão no relatório de pendências.
              </div>
              <div style={{ marginBottom: 12 }}>
                Mostrando {visiblePendingItems.length} de {pendingItems.length} pendências
              </div>

              {visiblePendingItems.map((item) => (
                <div
                  key={`${item.type}-${item.row}`}
                  style={{
                    marginTop: 10,
                    padding: 12,
                    border: '1px solid #fecaca',
                    borderRadius: 4,
                    backgroundColor: '#fff',
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>
                    Linha {item.row} — {item.type.toUpperCase()}
                  </div>
                  <div><strong>Motivo:</strong> {item.reason || '—'}</div>
                  <div><strong>Código:</strong> {item.code ?? '—'}</div>
                  <div><strong>ID:</strong> {item.idInt ?? '—'}</div>
                  <div><strong>MLB:</strong> {item.mlbId ?? '—'}</div>
                  <div><strong>Título:</strong> {item.title ?? '—'}</div>

                  {item.conflictDetails && (
                    <div style={{ marginTop: 8 }}>
                      <strong>Possível peça existente:</strong>
                      <div>Código: {item.conflictDetails.candidate.code ?? '—'}</div>
                      <div>ID: {item.conflictDetails.candidate.id_int ?? '—'}</div>
                      <div>MLB: {item.conflictDetails.candidate.id_string ?? '—'}</div>
                      <div>Título: {item.conflictDetails.candidate.title ?? '—'}</div>
                    </div>
                  )}

                  {item.errors.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <strong>Erros:</strong> {item.errors.join(', ')}
                    </div>
                  )}

                  {debugMode && (
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ cursor: 'pointer' }}>Detalhes técnicos</summary>
                      <pre style={{ overflow: 'auto', background: '#f6f6f6', padding: 8, fontSize: 12 }}>
{JSON.stringify(item.technicalDetails, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            disabled={executionBlocked || isAnalyzing || isExecuting || hasExecuted}
            onClick={async () => {
              setPersistError(null);
              setExecutionResult(null);
              setIsExecuting(true);
              setPersistProgress(0);
              try {
                if (!selectedFile || !analysisResult) {
                  throw new Error('Analise a planilha antes de executar.');
                }

                const result = await executeImportWithHistory({
                  file: selectedFile,
                  storeId: storeId.trim(),
                  inventoryAdapter: supabaseInventoryAdapter,
                  historyAdapter: supabaseImportHistoryAdapter,
                  storageLocationAdapter: supabaseStorageLocationAdapter,
                  adapterName: 'supabase',
                  engineVersion: '1.0.0',
                  debugMatching: true,
                  onProgress: (progress) => setPersistProgress(progress),
                });
                applyImportResult(result.importResult);
                setExecutionResult(result);
                setHasExecuted(true);
              } catch (err: unknown) {
                setPersistError(err instanceof Error ? err.message : String(err));
              } finally {
                setIsExecuting(false);
              }
            }}
            style={{
              padding: '10px 16px',
              fontSize: 14,
              cursor: executionBlocked || isAnalyzing || isExecuting || hasExecuted
                ? 'not-allowed'
                : 'pointer',
            }}
          >
            {isExecuting ? 'Executando importação...' : 'Executar Importação'}
          </button>

          {hasAnalyzed && executionBlocked && (
            <div style={{ color: '#b45309', marginTop: 8 }}>
              Não há ações executáveis nesta importação.
            </div>
          )}

          {isExecuting && (
            <div style={{ marginTop: 8 }}>Progresso: {persistProgress}%</div>
          )}

          {persistError && (
            <div style={{ color: 'red', marginTop: 8 }}>Erro: {persistError}</div>
          )}

          {hasExecuted && executionResult && (
            <div style={{ marginTop: 12 }}>
              <div style={{ color: '#15803d', fontWeight: 'bold', marginBottom: 8 }}>
                Importação executada com sucesso.
              </div>
              <div>Import Run ID: {executionResult.runId}</div>
              <div>Created: {executionResult.persistResult.created}</div>
              <div>Updated: {executionResult.persistResult.updated}</div>
              <div>Skipped: {executionResult.persistResult.skipped}</div>
              <div>
                Pending: {executionResult.persistResult.conflicts + executionResult.persistResult.invalid}
              </div>
              <div>Failed: {executionResult.persistResult.failed}</div>
              {debugMode && executionResult.persistResult.errors.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong>Errors</strong>
                  <pre style={{ maxHeight: 220, overflow: 'auto', background: '#fff3cd', padding: 8, fontSize: 12 }}>
{JSON.stringify(executionResult.persistResult.errors.slice(0, 20), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {debugMode && matchingStats && (
        <div style={{ marginTop: 12, border: '1px solid #ccc', padding: 12 }}>
          <h2>Matching Stats</h2>
          <div>Existing Parts: {matchingStats.existingPartsCount}</div>
          <div>Total Rows: {matchingStats.totalRows}</div>
          <div>Valid Rows: {validCount}</div>
          <div>Warnings: {warningsCount}</div>
          <div>Changed Updates: {changedUpdatesCount}</div>
          <div>Unchanged Updates: {importPlan ? importPlan.summary.unchangedUpdates : unchangedUpdatesCount}</div>
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

      {debugMode && (
        <div style={{ marginTop: 12 }}>
          <h2>Conflitos e títulos semelhantes</h2>
          {conflictDetails.length === 0 ? (
            <div style={{ color: '#666' }}>Nenhum conflito.</div>
          ) : (
            conflictDetails.map((conflict) => (
              <div
                key={`${conflict.imported.row}-${conflict.candidate.id ?? 'unknown'}`}
                style={{
                  marginTop: 8,
                  padding: 12,
                  border: '1px solid #f0c36d',
                  borderRadius: 4,
                  backgroundColor: '#fff8e1',
                }}
              >
                <div><strong>Linha:</strong> {conflict.imported.row}</div>
                <div><strong>Ação final:</strong> {conflict.finalAction}</div>
                {conflict.warning && (
                  <div><strong>Warning:</strong> {conflict.warning}</div>
                )}
                <div><strong>Título importado:</strong> {conflict.imported.title ?? '-'}</div>
                <div>
                  <strong>Possível peça existente:</strong>{' '}
                  {conflict.candidate.code ?? conflict.candidate.id ?? '-'}
                </div>
                <div><strong>Matched title:</strong> {conflict.candidate.title ?? '-'}</div>
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer' }}>Detalhes do conflito</summary>
                  <pre style={{ overflow: 'auto', background: '#fff', padding: 8, fontSize: 12 }}>
{JSON.stringify(conflict, null, 2)}
                  </pre>
                </details>
              </div>
            ))
          )}
        </div>
      )}

      {debugMode && (
        <div style={{ marginTop: 12 }}>
          <h2>Compare Debug (first 10 updates)</h2>
          <pre style={{ maxHeight: 500, overflow: 'auto', background: '#fff3cd', padding: 12 }}>
{JSON.stringify(compareDebugUpdates, null, 2)}
          </pre>
        </div>
      )}

      {debugMode && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Preview JSON</summary>
          <pre style={{ maxHeight: 400, overflow: 'auto', background: '#f6f6f6', padding: 12 }}>
{JSON.stringify(preview, null, 2)}
          </pre>
        </details>
      )}
    </main>
  );
}
