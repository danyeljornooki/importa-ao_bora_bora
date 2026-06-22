'use client'

import React, { useState } from 'react';
import Link from 'next/link';
import { AppNavigation } from '../../../components/AppNavigation';
import {
  authenticateMercadoLivreIntegration,
  MercadoLivreAuthenticationError,
  type MercadoLivreAuthenticationAttempt,
} from '../../../adapters/mercado-livre/mercadoLivreAuthAdapter';
import { supabaseImportHistoryAdapter } from '../../../adapters/supabase/supabaseImportHistoryAdapter';
import { supabaseInventoryAdapter } from '../../../adapters/supabase/supabaseInventoryAdapter';
import { mercadoLivreAdapter } from '../../../adapters/mercado-livre/mercadoLivreAdapter';
import { supabaseMarketplaceAdAdapter } from '../../../adapters/supabase/supabaseMarketplaceAdAdapter';
import {
  executePartImportWithComplements,
  type ExecutePartImportWithComplementsResult,
} from '../../../engine/executePartImportWithComplements';
import {
  runImport,
  type ConflictDetail,
  type RunImportResult,
} from '../../../engine/runImport';
import type { ImportActionType } from '../../../modules/importer/planner/buildImportPlan';
import type { PartCanonical } from '../../../modules/importer/schemas/part.schema';
import type { ImportExecutionContext } from '../../../types/integration.types';
import { parseExcel } from '../../../core/importer/parse/parseExcel';
import {
  suggestFieldMapping,
  type ColumnMapping,
} from '../../../modules/importer/suggestFieldMapping';
import {
  canonicalFieldKeys,
  type CanonicalField,
} from '../../../modules/importer/fieldAliases';
import type {
  RowFilterRule,
  RowFilterCondition,
} from '../../../modules/importer/rowFilters';

const FIELD_LABELS: Record<CanonicalField, string> = {
  code: 'Código',
  id_int: 'ID interno (id_int)',
  title: 'Título / Nome',
  price: 'Preço',
  stock_quantity: 'Quantidade / Estoque',
  location: 'Localização',
  description: 'Descrição',
  mlb_ids: 'Código(s) MLB',
  image_urls: 'Imagens (URLs)',
};

const CONDITION_LABELS: Record<RowFilterCondition, string> = {
  equals: 'é igual a',
  notEquals: 'é diferente de',
  contains: 'contém',
  notContains: 'não contém',
  isEmpty: 'está vazio',
  isNotEmpty: 'está preenchido',
};

const conditionNeedsValue = (condition: RowFilterCondition): boolean =>
  condition !== 'isEmpty' && condition !== 'isNotEmpty';

interface PreviewItem {
  row: number;
  valid: boolean;
  action?: ImportActionType;
  reason?: string;
  data?: PartCanonical;
  errors?: string[];
  conflictDetails?: ConflictDetail;
}

interface PendingItem {
  row: number;
  type: 'conflict' | 'invalid';
  reason: string;
  title: string | null;
  code: string | null;
  mlbId: string | null;
  conflictDetails?: ConflictDetail;
}

type ChecklistKey =
  | 'integration'
  | 'file'
  | 'complements'
  | 'rejectedRows';

const initialChecklist: Record<ChecklistKey, boolean> = {
  integration: false,
  file: false,
  complements: false,
  rejectedRows: false,
};

const sectionStyle: React.CSSProperties = {
  padding: 20,
  border: '1px solid #dbe2ea',
  borderRadius: 10,
  backgroundColor: '#fff',
  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 8,
  color: '#334155',
  fontSize: 14,
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: 14,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '11px 18px',
  border: 0,
  borderRadius: 6,
  backgroundColor: '#1d4ed8',
  color: '#fff',
  fontSize: 14,
  fontWeight: 700,
};

const firstMlbId = (part?: PartCanonical): string | null => {
  if (Array.isArray(part?.mlb_ids) && part.mlb_ids.length > 0) {
    return part.mlb_ids[0] ?? null;
  }

  return part?.id_string ?? null;
};

const marketplaceNickname = (
  context: ImportExecutionContext | null
): string | null => {
  const nickname = context?.marketplace?.user?.nickname;
  return typeof nickname === 'string' && nickname.trim() !== ''
    ? nickname.trim()
    : null;
};

const buildPendingItems = (result: RunImportResult | null): PendingItem[] => {
  if (!result) return [];

  const previews = result.previewItems as PreviewItem[];
  const previewByRow = new Map(previews.map((item) => [item.row, item]));
  const conflictsByRow = new Map(
    result.conflictDetails
      .filter((detail) => detail.finalAction === 'conflict')
      .map((detail) => [detail.imported.row, detail])
  );

  return result.importPlan.actions
    .filter((action) => action.type === 'conflict' || action.type === 'invalid')
    .map((action): PendingItem => {
      const preview = previewByRow.get(action.row);
      const conflictDetails = preview?.conflictDetails ?? conflictsByRow.get(action.row);
      const data = action.data ?? preview?.data;
      const errors = preview?.errors ?? [];

      return {
        row: action.row,
        type: action.type as PendingItem['type'],
        reason: errors.length > 0
          ? errors.join(', ')
          : preview?.reason ?? action.reason,
        title: data?.title ?? conflictDetails?.imported.title ?? null,
        code: data?.code ?? conflictDetails?.imported.code ?? null,
        mlbId: firstMlbId(data) ?? conflictDetails?.imported.mlb_id ?? null,
        conflictDetails,
      };
    })
    .sort((a, b) => a.row - b.row);
};

const Metric = ({ label, value }: { label: string; value: number | string }) => (
  <div
    style={{
      padding: 14,
      border: '1px solid #e2e8f0',
      borderRadius: 8,
      backgroundColor: '#f8fafc',
    }}
  >
    <div style={{ color: '#64748b', fontSize: 12, textTransform: 'uppercase' }}>{label}</div>
    <div style={{ marginTop: 4, color: '#0f172a', fontSize: 22, fontWeight: 700 }}>{value}</div>
  </div>
);

export default function PartsImportPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [integrationId, setIntegrationId] = useState<string>('');
  const [executionContext, setExecutionContext] = useState<ImportExecutionContext | null>(null);
  const [isLoadingIntegration, setIsLoadingIntegration] = useState<boolean>(false);
  const [integrationError, setIntegrationError] = useState<string | null>(null);
  const [integrationErrorDetails, setIntegrationErrorDetails] = useState<
    MercadoLivreAuthenticationAttempt[]
  >([]);
  const [analysisResult, setAnalysisResult] = useState<RunImportResult | null>(null);
  const [executionResult, setExecutionResult] =
    useState<ExecutePartImportWithComplementsResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [hasAnalyzed, setHasAnalyzed] = useState<boolean>(false);
  const [hasExecuted, setHasExecuted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [executionProgress, setExecutionProgress] = useState<number>(0);
  const [checklist, setChecklist] =
    useState<Record<ChecklistKey, boolean>>(initialChecklist);

  // Mapeamento assistido de colunas
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [mappingScores, setMappingScores] = useState<Record<string, number>>({});
  const [sampleRows, setSampleRows] = useState<Record<string, unknown>[]>([]);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  // Regras de importação configuráveis pelo usuário
  const [rowFilters, setRowFilters] = useState<RowFilterRule[]>([]);
  const [newFilter, setNewFilter] = useState<{
    column: string;
    condition: RowFilterCondition;
    value: string;
  }>({ column: '', condition: 'equals', value: '' });

  const handleFileSelected = async (file: File | null) => {
    setSelectedFile(file);
    clearResults();
    setHeaders([]);
    setColumnMapping({});
    setMappingScores({});
    setSampleRows([]);
    setAiMessage(null);
    if (!file) return;
    try {
      const parsed = await parseExcel(file as any);
      const headerSet = new Set<string>();
      parsed.rows.forEach((row) =>
        Object.keys(row as Record<string, unknown>).forEach((k) => headerSet.add(k))
      );
      const headerList = Array.from(headerSet);
      setHeaders(headerList);
      setSampleRows((parsed.rows as Record<string, unknown>[]).slice(0, 10));

      const { suggestions } = suggestFieldMapping(headerList);
      const mapping: ColumnMapping = {};
      const scores: Record<string, number> = {};
      for (const s of suggestions) {
        mapping[s.field] = s.header;
        scores[s.field] = s.score;
      }
      setColumnMapping(mapping);
      setMappingScores(scores);
    } catch {
      // se falhar o parse aqui, o erro real aparece na análise
    }
  };

  const handleAiSuggest = async () => {
    if (headers.length === 0) return;
    setIsAiLoading(true);
    setAiMessage(null);
    try {
      const response = await fetch('/api/import/suggest-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers, sample: sampleRows }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAiMessage(data?.error ?? `Erro ${response.status}`);
        return;
      }
      const aiMapping = (data?.mapping ?? {}) as ColumnMapping;
      const applied = Object.keys(aiMapping).length;
      if (applied === 0) {
        setAiMessage('A IA não sugeriu nenhum mapeamento novo.');
        return;
      }
      setColumnMapping((current) => ({ ...current, ...aiMapping }));
      setMappingScores((current) => {
        const next = { ...current };
        for (const field of Object.keys(aiMapping)) next[field] = 1;
        return next;
      });
      setHasAnalyzed(false);
      setAnalysisResult(null);
      setAiMessage(`IA sugeriu ${applied} mapeamento(s). Revise antes de analisar.`);
    } catch (err) {
      setAiMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAiLoading(false);
    }
  };

  const addRowFilter = () => {
    const column = newFilter.column.trim();
    if (!column) return;
    const rule: RowFilterRule = {
      column,
      condition: newFilter.condition,
      ...(conditionNeedsValue(newFilter.condition) ? { value: newFilter.value } : {}),
    };
    setRowFilters((current) => [...current, rule]);
    setNewFilter({ column: '', condition: 'equals', value: '' });
    setHasAnalyzed(false);
    setAnalysisResult(null);
  };

  const removeRowFilter = (index: number) => {
    setRowFilters((current) => current.filter((_, i) => i !== index));
    setHasAnalyzed(false);
    setAnalysisResult(null);
  };

  const clearResults = () => {
    setAnalysisResult(null);
    setExecutionResult(null);
    setHasAnalyzed(false);
    setHasExecuted(false);
    setError(null);
    setExecutionProgress(0);
    setChecklist(initialChecklist);
  };

  const handleLoadIntegration = async () => {
    setIsLoadingIntegration(true);
    setIntegrationError(null);
    setIntegrationErrorDetails([]);
    setExecutionContext(null);
    clearResults();

    try {
      const context = await authenticateMercadoLivreIntegration(integrationId);
      setExecutionContext(context);
    } catch (caughtError: unknown) {
      setIntegrationError(
        caughtError instanceof Error ? caughtError.message : String(caughtError)
      );
      setIntegrationErrorDetails(
        caughtError instanceof MercadoLivreAuthenticationError
          ? caughtError.attempts
          : []
      );
    } finally {
      setIsLoadingIntegration(false);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile || !executionContext) {
      setError('Carregue a integração e selecione uma planilha.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setExecutionResult(null);
    setHasExecuted(false);
    setChecklist(initialChecklist);

    try {
      const result = await runImport(await selectedFile.arrayBuffer(), {
        storeId: executionContext.storeId,
        adapter: supabaseInventoryAdapter,
        integrationId: executionContext.integrationId,
        debugMatching: debugMode,
        rowFilters,
        columnMapping,
      });

      setAnalysisResult(result);
      setHasAnalyzed(true);
    } catch (caughtError: unknown) {
      setAnalysisResult(null);
      setHasAnalyzed(false);
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedFile || !analysisResult || !executionContext) {
      setError('Analise a planilha antes de executar a importação.');
      return;
    }

    setIsExecuting(true);
    setError(null);
    setExecutionProgress(0);

    try {
      const result = await executePartImportWithComplements({
        analysisResult,
        executionContext,
        inventoryAdapter: supabaseInventoryAdapter,
        historyAdapter: supabaseImportHistoryAdapter,
        adRegistryAdapter: supabaseMarketplaceAdAdapter,
        marketplaceAdapter: mercadoLivreAdapter,
        options: {
          fileName: selectedFile.name,
          adapterName: 'supabase',
          engineVersion: '1.1.0',
          metadata: {
            fileSize: selectedFile.size,
            fileType: selectedFile.type || null,
            debugMatching: debugMode,
            integrationName: executionContext.integrationName ?? null,
            marketplaceUserId: executionContext.marketplace?.userId ?? null,
            marketplaceNickname: marketplaceNickname(executionContext),
            // Auditoria: regras usadas e linhas excluídas por elas ficam no import_run.
            rowFilters,
            excludedCount: analysisResult.excluded,
            excludedRows: analysisResult.excludedRows,
            columnMapping,
          },
          onProgress: setExecutionProgress,
        },
      });

      setAnalysisResult(result.importResult);
      setExecutionResult(result);
      setHasExecuted(true);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setIsExecuting(false);
    }
  };

  const summary = analysisResult?.summary;
  const pendingItems = buildPendingItems(analysisResult);
  const visiblePendingItems = pendingItems.slice(0, 20);
  const executableActions =
    (summary?.creates ?? 0) + (summary?.updates ?? 0);
  const complementPreviewActions =
    analysisResult?.importPlan.actions.filter((action) =>
      action.type === 'create' ||
      action.type === 'update' ||
      action.type === 'skip'
    ) ?? [];
  const pendingAdPreview = complementPreviewActions.filter((action) =>
    Array.isArray(action.data?.mlb_ids) &&
    action.data.mlb_ids.some((value) => value.trim() !== '')
  ).length;
  const sheetImagePreview = complementPreviewActions.filter((action) =>
    Array.isArray(action.data?.image_urls) &&
    action.data.image_urls.some((value) => value.trim() !== '')
  ).length;
  const noImagePreview = complementPreviewActions.length - sheetImagePreview;
  const checklistComplete = Object.values(checklist).every(Boolean);
  const canExecute =
    hasAnalyzed &&
    !hasExecuted &&
    executionContext !== null &&
    executableActions > 0 &&
    checklistComplete &&
    !isAnalyzing &&
    !isExecuting;
  const pendingAdItems =
    executionResult?.rows.filter((row) =>
      ['pending', 'failed', 'conflict', 'invalid'].includes(
        row.adLinkResult.action
      )
    ) ?? [];

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '32px 20px 56px',
        backgroundColor: '#f1f5f9',
        color: '#0f172a',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div style={{ width: '100%', maxWidth: 1080, margin: '0 auto' }}>
        <AppNavigation />
        <header style={{ marginBottom: 24 }}>
          <div style={{ color: '#2563eb', fontSize: 13, fontWeight: 700 }}>Importações / Peças v1</div>
          <h1 style={{ margin: '6px 0 8px', fontSize: 32 }}>Importação de Peças</h1>
          <p style={{ margin: 0, color: '#475569' }}>
            Analise a planilha antes de executar alterações no estoque.
          </p>
          <div style={{ marginTop: 10 }}>
            <Link href="/importacoes/historico">Ver histórico de importações</Link>
          </div>
        </header>

        <div style={{ display: 'grid', gap: 18 }}>
          <section style={sectionStyle}>
            <h2 style={{ marginTop: 0 }}>1. Contexto</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) auto', gap: 12, alignItems: 'end' }}>
              <label>
                <span style={labelStyle}>Integration ID</span>
                <input
                  type="text"
                  value={integrationId}
                  disabled={isLoadingIntegration || isAnalyzing || isExecuting}
                  placeholder="Informe o identificador da integração"
                  onChange={(event) => {
                    setIntegrationId(event.target.value);
                    setExecutionContext(null);
                    setIntegrationError(null);
                    setIntegrationErrorDetails([]);
                    clearResults();
                  }}
                  style={inputStyle}
                />
              </label>
              <button
                type="button"
                onClick={handleLoadIntegration}
                disabled={
                  integrationId.trim() === '' ||
                  isLoadingIntegration ||
                  isAnalyzing ||
                  isExecuting
                }
                style={{
                  ...primaryButtonStyle,
                  opacity:
                    integrationId.trim() === '' || isLoadingIntegration ? 0.55 : 1,
                  cursor:
                    integrationId.trim() === '' || isLoadingIntegration
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                {isLoadingIntegration ? 'Carregando...' : 'Carregar Integração'}
              </button>
            </div>

            {integrationError && (
              <div style={{ marginTop: 12, color: '#b91c1c' }}>{integrationError}</div>
            )}

            {integrationErrorDetails.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  padding: 14,
                  border: '1px solid #fecaca',
                  borderRadius: 8,
                  backgroundColor: '#fef2f2',
                }}
              >
                <strong>Erro técnico:</strong>
                <div style={{ display: 'grid', gap: 12, marginTop: 10 }}>
                  {integrationErrorDetails.map((attempt) => (
                    <div
                      key={attempt.format}
                      style={{
                        padding: 10,
                        border: '1px solid #fecaca',
                        borderRadius: 6,
                        backgroundColor: '#fff',
                      }}
                    >
                      <div><strong>Formato:</strong> {attempt.format}</div>
                      <div><strong>Status:</strong> {attempt.status ?? 'sem resposta HTTP'}</div>
                      <div><strong>Headers:</strong></div>
                      <pre style={{ overflow: 'auto', margin: '4px 0 8px', padding: 8, backgroundColor: '#f8fafc' }}>
{JSON.stringify(attempt.headers, null, 2)}
                      </pre>
                      <div><strong>Body:</strong></div>
                      <pre style={{ overflow: 'auto', margin: '4px 0 0', padding: 8, backgroundColor: '#f8fafc', whiteSpace: 'pre-wrap' }}>
{attempt.body}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {executionContext && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                  gap: 10,
                  marginTop: 16,
                  padding: 14,
                  border: '1px solid #bfdbfe',
                  borderRadius: 8,
                  backgroundColor: '#eff6ff',
                }}
              >
                <div><strong>Loja ID:</strong> {executionContext.storeId}</div>
                <div><strong>Nome:</strong> {executionContext.integrationName ?? '-'}</div>
                <div><strong>Canal:</strong> {executionContext.channel}</div>
                <div><strong>User ID:</strong> {executionContext.marketplace?.userId ?? '-'}</div>
                <div><strong>Nickname:</strong> {marketplaceNickname(executionContext) ?? '-'}</div>
                <div><strong>Token expira em:</strong> {executionContext.marketplace?.tokenExpiresIn ?? '-'}</div>
                <div><strong>Adapter atual:</strong> Supabase</div>
                {debugMode && (
                  <div>
                    <strong>Token:</strong>{' '}
                    {executionContext.marketplace?.accessToken ? 'presente' : 'ausente'}
                  </div>
                )}
              </div>
            )}
          </section>

          <section style={sectionStyle}>
            <h2 style={{ marginTop: 0 }}>2. Upload</h2>
            <label>
              <span style={labelStyle}>Planilha de peças</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                disabled={isAnalyzing || isExecuting}
                onChange={(event) => {
                  void handleFileSelected(event.target.files?.[0] ?? null);
                }}
              />
            </label>
            <div style={{ marginTop: 12, color: selectedFile ? '#0f172a' : '#64748b' }}>
              Arquivo selecionado: <strong>{selectedFile?.name ?? 'nenhum arquivo'}</strong>
            </div>
          </section>

          {headers.length > 0 && (
            <section style={sectionStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h2 style={{ marginTop: 0, marginBottom: 0 }}>Mapeamento de Colunas</h2>
                <button
                  type="button"
                  onClick={handleAiSuggest}
                  disabled={isAiLoading || isAnalyzing || isExecuting || hasExecuted}
                  style={{
                    ...primaryButtonStyle,
                    backgroundColor: '#7c3aed',
                    opacity: isAiLoading ? 0.6 : 1,
                    cursor: isAiLoading ? 'wait' : 'pointer',
                  }}
                >
                  {isAiLoading ? 'Consultando IA...' : '🤖 Melhorar com IA'}
                </button>
              </div>
              <p style={{ margin: '8px 0 14px', color: '#475569', fontSize: 14 }}>
                Detectamos as colunas por similaridade. Confira e ajuste antes de analisar —
                cada cliente nomeia as colunas do seu jeito. Use a IA para os casos difíceis.
              </p>
              {aiMessage && (
                <div style={{ marginBottom: 12, padding: 10, borderRadius: 6, backgroundColor: '#f5f3ff', color: '#5b21b6', fontSize: 13 }}>
                  {aiMessage}
                </div>
              )}
              <div style={{ display: 'grid', gap: 10 }}>
                {canonicalFieldKeys.map((field) => {
                  const score = mappingScores[field] ?? 0;
                  const selected = columnMapping[field] ?? '';
                  return (
                    <div
                      key={field}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr) auto',
                        gap: 10,
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>
                        {FIELD_LABELS[field]}
                      </span>
                      <select
                        value={selected}
                        disabled={isAnalyzing || isExecuting || hasExecuted}
                        onChange={(event) => {
                          const value = event.target.value || null;
                          setColumnMapping((current) => ({ ...current, [field]: value }));
                          setHasAnalyzed(false);
                          setAnalysisResult(null);
                        }}
                        style={inputStyle}
                      >
                        <option value="">— não usar —</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      <span style={{ fontSize: 12, color: selected ? '#15803d' : '#94a3b8', minWidth: 90 }}>
                        {selected
                          ? score >= 0.999
                            ? 'exato'
                            : `${Math.round(score * 100)}%`
                          : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {selectedFile && (
            <section style={sectionStyle}>
              <h2 style={{ marginTop: 0 }}>Regras de Importação (opcional)</h2>
              <p style={{ margin: '0 0 14px', color: '#475569', fontSize: 14 }}>
                Defina quais linhas NÃO devem ser importadas (ex: coluna <code>codigo</code> igual a
                <code> EXCLUIDO</code>, ou código vazio). As regras valem só para esta importação.
              </p>

              {rowFilters.length > 0 && (
                <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
                  {rowFilters.map((rule, index) => (
                    <div
                      key={`${rule.column}-${rule.condition}-${index}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '8px 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: 6,
                        backgroundColor: '#f8fafc',
                        fontSize: 14,
                      }}
                    >
                      <span>
                        Não importar se <strong>{rule.column}</strong> {CONDITION_LABELS[rule.condition]}
                        {conditionNeedsValue(rule.condition) ? ` "${rule.value ?? ''}"` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeRowFilter(index)}
                        disabled={isAnalyzing || isExecuting || hasExecuted}
                        style={{
                          border: '1px solid #fecaca',
                          color: '#b91c1c',
                          backgroundColor: '#fff',
                          borderRadius: 6,
                          padding: '4px 10px',
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto',
                  gap: 10,
                  alignItems: 'end',
                }}
              >
                <label>
                  <span style={labelStyle}>Coluna</span>
                  {headers.length > 0 ? (
                    <select
                      value={newFilter.column}
                      disabled={isAnalyzing || isExecuting || hasExecuted}
                      onChange={(event) => setNewFilter((c) => ({ ...c, column: event.target.value }))}
                      style={inputStyle}
                    >
                      <option value="">— escolher —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={newFilter.column}
                      placeholder="nome da coluna"
                      disabled={isAnalyzing || isExecuting || hasExecuted}
                      onChange={(event) => setNewFilter((c) => ({ ...c, column: event.target.value }))}
                      style={inputStyle}
                    />
                  )}
                </label>
                <label>
                  <span style={labelStyle}>Condição</span>
                  <select
                    value={newFilter.condition}
                    disabled={isAnalyzing || isExecuting || hasExecuted}
                    onChange={(event) =>
                      setNewFilter((c) => ({ ...c, condition: event.target.value as RowFilterCondition }))
                    }
                    style={inputStyle}
                  >
                    {(Object.keys(CONDITION_LABELS) as RowFilterCondition[]).map((cond) => (
                      <option key={cond} value={cond}>{CONDITION_LABELS[cond]}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span style={labelStyle}>Valor</span>
                  <input
                    type="text"
                    value={newFilter.value}
                    disabled={
                      !conditionNeedsValue(newFilter.condition) || isAnalyzing || isExecuting || hasExecuted
                    }
                    placeholder={conditionNeedsValue(newFilter.condition) ? 'ex: EXCLUIDO' : '—'}
                    onChange={(event) => setNewFilter((c) => ({ ...c, value: event.target.value }))}
                    style={{
                      ...inputStyle,
                      opacity: conditionNeedsValue(newFilter.condition) ? 1 : 0.5,
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={addRowFilter}
                  disabled={!newFilter.column.trim() || isAnalyzing || isExecuting || hasExecuted}
                  style={{
                    ...primaryButtonStyle,
                    backgroundColor: '#0f766e',
                    opacity: !newFilter.column.trim() ? 0.55 : 1,
                    cursor: !newFilter.column.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  Adicionar regra
                </button>
              </div>
            </section>
          )}

          <section style={sectionStyle}>
            <h2 style={{ marginTop: 0 }}>3. Análise</h2>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!selectedFile || !executionContext || isAnalyzing || isExecuting || hasExecuted}
              style={{
                ...primaryButtonStyle,
                opacity: !selectedFile || !executionContext || isAnalyzing || isExecuting || hasExecuted ? 0.55 : 1,
                cursor: !selectedFile || !executionContext || isAnalyzing || isExecuting || hasExecuted
                  ? 'not-allowed'
                  : 'pointer',
              }}
            >
              {isAnalyzing ? 'Analisando...' : 'Analisar Planilha'}
            </button>

            {hasAnalyzed && summary && (
              <>
                <div style={{ marginTop: 14, color: '#166534', fontWeight: 700 }}>
                  Dry Run concluído. Nenhum dado foi gravado.
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: 10,
                    marginTop: 16,
                  }}
                >
                  <Metric label="Sheet Name" value={analysisResult?.sheetName ?? '-'} />
                  <Metric label="Rows" value={summary.totalRows} />
                  <Metric label="Creates" value={summary.creates} />
                  <Metric label="Updates" value={summary.updates} />
                  <Metric label="Skipped" value={summary.skipped} />
                  <Metric label="Conflicts" value={summary.conflicts} />
                  <Metric label="Invalid" value={summary.invalid} />
                  <Metric label="Excluídas (regra)" value={analysisResult?.excluded ?? 0} />
                  <Metric label="Warnings" value={summary.warnings} />
                </div>
                {(analysisResult?.excluded ?? 0) > 0 && (
                  <div style={{ marginTop: 12, color: '#475569', fontSize: 13 }}>
                    {analysisResult?.excluded} linha(s) não importada(s) por regra de filtro
                    {analysisResult?.excludedRows?.[0]
                      ? ` (ex: linha ${analysisResult.excludedRows[0].row} — ${analysisResult.excludedRows[0].reason})`
                      : ''}.
                  </div>
                )}
              </>
            )}
          </section>

          {pendingItems.length > 0 && (
            <section style={{ ...sectionStyle, borderColor: '#f59e0b', backgroundColor: '#fffbeb' }}>
              <h2 style={{ marginTop: 0 }}>4. Pendências não importadas</h2>
              <p style={{ color: '#92400e' }}>
                {pendingItems.length} {pendingItems.length === 1 ? 'linha ficará' : 'linhas ficarão'} no relatório
                para correção manual. Essas pendências não bloqueiam as demais ações.
              </p>
              <div style={{ marginBottom: 12, color: '#64748b', fontSize: 13 }}>
                Mostrando {visiblePendingItems.length} de {pendingItems.length} pendências.
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {visiblePendingItems.map((item) => (
                  <article
                    key={`${item.type}-${item.row}`}
                    style={{ padding: 14, border: '1px solid #fde68a', borderRadius: 8, backgroundColor: '#fff' }}
                  >
                    <div style={{ marginBottom: 8, fontWeight: 700 }}>
                      Linha {item.row} - {item.type.toUpperCase()}
                    </div>
                    <div><strong>Motivo:</strong> {item.reason || '-'}</div>
                    <div><strong>Título:</strong> {item.title ?? '-'}</div>
                    <div><strong>Código:</strong> {item.code ?? '-'}</div>
                    <div><strong>MLB:</strong> {item.mlbId ?? '-'}</div>
                    {item.conflictDetails && (
                      <div style={{ marginTop: 8, color: '#475569' }}>
                        Possível peça existente: {item.conflictDetails.candidate.title
                          ?? item.conflictDetails.candidate.code
                          ?? item.conflictDetails.candidate.id
                          ?? '-'}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {hasAnalyzed && summary && (
            <section style={sectionStyle}>
              <h2 style={{ marginTop: 0 }}>Checklist antes de executar</h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 10,
                }}
              >
                <Metric label="Integration ID" value={executionContext?.integrationId ?? '-'} />
                <Metric label="Loja / storeId" value={executionContext?.storeId ?? '-'} />
                <Metric label="Nome da integração" value={executionContext?.integrationName ?? '-'} />
                <Metric label="Arquivo" value={selectedFile?.name ?? '-'} />
                <Metric label="Total de linhas" value={summary.totalRows} />
                <Metric label="Creates" value={summary.creates} />
                <Metric label="Updates" value={summary.updates} />
                <Metric label="Skipped" value={summary.skipped} />
                <Metric label="Conflicts" value={summary.conflicts} />
                <Metric label="Invalid" value={summary.invalid} />
                <Metric label="Complement Pending" value={pendingAdPreview} />
                <Metric label="Anúncios pendentes" value={pendingAdPreview} />
                <Metric label="Imagens ML" value="A confirmar" />
                <Metric label="Imagens planilha" value={sheetImagePreview} />
                <Metric label="Sem imagem" value={noImagePreview} />
              </div>

              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 6,
                  backgroundColor: '#eff6ff',
                  color: '#1e3a8a',
                  fontSize: 13,
                }}
              >
                Prévia operacional: anúncios e imagens do Mercado Livre são
                resolvidos durante o commit. Os valores finais aparecem no
                resultado da execução.
              </div>

              <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                {summary.creates > 0 && (
                  <div style={{ color: '#92400e' }}>Novas peças serão criadas.</div>
                )}
                {summary.updates > 0 && (
                  <div style={{ color: '#92400e' }}>Peças existentes serão atualizadas.</div>
                )}
                {summary.conflicts > 0 && (
                  <div style={{ color: '#b91c1c' }}>Conflitos não serão importados.</div>
                )}
                {summary.invalid > 0 && (
                  <div style={{ color: '#b91c1c' }}>Linhas inválidas não serão importadas.</div>
                )}
                {pendingAdPreview > 0 && (
                  <div style={{ color: '#92400e' }}>Alguns complementos ficarão pendentes.</div>
                )}
              </div>

              <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
                {([
                  ['integration', 'Conferi que a integração/loja está correta'],
                  ['file', 'Conferi que o arquivo selecionado está correto'],
                  ['complements', 'Entendo que pendências complementares não bloqueiam a peça'],
                  ['rejectedRows', 'Entendo que conflitos/linhas inválidas não serão importados'],
                ] as Array<[ChecklistKey, string]>).map(([key, label]) => (
                  <label
                    key={key}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}
                  >
                    <input
                      type="checkbox"
                      checked={checklist[key]}
                      disabled={hasExecuted || isExecuting}
                      onChange={(event) =>
                        setChecklist((current) => ({
                          ...current,
                          [key]: event.target.checked,
                        }))
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </section>
          )}

          <section style={sectionStyle}>
            <h2 style={{ marginTop: 0 }}>{pendingItems.length > 0 ? '5' : '4'}. Execução</h2>
            <div
              style={{
                marginBottom: 14,
                padding: 12,
                borderRadius: 6,
                backgroundColor: '#eff6ff',
                color: '#1e3a8a',
              }}
            >
              A importação será parcial se houver pendências. Linhas com conflito ou inválidas não serão cadastradas.
            </div>

            <button
              type="button"
              onClick={handleExecute}
              disabled={!canExecute}
              style={{
                ...primaryButtonStyle,
                backgroundColor: '#15803d',
                opacity: canExecute ? 1 : 0.55,
                cursor: canExecute ? 'pointer' : 'not-allowed',
              }}
            >
              {isExecuting ? 'Executando Importação...' : 'Executar Importação'}
            </button>

            {hasAnalyzed && executableActions === 0 && (
              <div style={{ marginTop: 10, color: '#92400e' }}>
                Nenhuma ação executável. Nada será gravado.
              </div>
            )}
            {isExecuting && (
              <div style={{ marginTop: 10 }}>Progresso: {executionProgress}%</div>
            )}
          </section>

          {executionResult && (
            <section style={{ ...sectionStyle, borderColor: '#86efac', backgroundColor: '#f0fdf4' }}>
              <h2 style={{ marginTop: 0 }}>{pendingItems.length > 0 ? '6' : '5'}. Resultado</h2>
              <div style={{ color: '#166534', fontWeight: 700 }}>
                Importação executada com sucesso.
              </div>
              <div style={{ marginTop: 8 }}>
                Histórico gerado: <strong>{executionResult.runId}</strong>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 10,
                  marginTop: 16,
                }}
              >
                <Metric label="Created" value={executionResult.summary.created} />
                <Metric label="Updated" value={executionResult.summary.updated} />
                <Metric label="Skipped" value={executionResult.summary.skipped} />
                <Metric label="Failed" value={executionResult.summary.failed} />
                <Metric label="Pending" value={executionResult.summary.pending} />
                <Metric
                  label="Complement Pending"
                  value={executionResult.summary.complementPending}
                />
              </div>
              <h3 style={{ marginBottom: 8 }}>Complementos</h3>
              <div style={{ display: 'grid', gap: 4 }}>
                <div>Anúncios vinculados: <strong>{executionResult.summary.linkedAds}</strong></div>
                <div>Anúncios pendentes: <strong>{executionResult.summary.pendingAds}</strong></div>
                <div>Anúncios com erro: <strong>{executionResult.summary.failedAds}</strong></div>
                <div>Imagens ML: <strong>{executionResult.summary.mlImages}</strong></div>
                <div>Imagens planilha: <strong>{executionResult.summary.sheetImages}</strong></div>
                <div>Sem imagem: <strong>{executionResult.summary.noImage}</strong></div>
              </div>
            </section>
          )}

          {pendingAdItems.length > 0 && (
            <section style={{ ...sectionStyle, borderColor: '#f59e0b', backgroundColor: '#fffbeb' }}>
              <h2 style={{ marginTop: 0 }}>Pendências de anúncio</h2>
              <div style={{ display: 'grid', gap: 10 }}>
                {pendingAdItems.map((item) => (
                  <article
                    key={`ad-pending-${item.row}`}
                    style={{
                      padding: 14,
                      border: '1px solid #fde68a',
                      borderRadius: 8,
                      backgroundColor: '#fff',
                    }}
                  >
                    <div><strong>row:</strong> {item.row}</div>
                    <div><strong>pecaId:</strong> {item.partResult.pecaId ?? '-'}</div>
                    <div><strong>mlbId:</strong> {item.adLinkResult.mlbId ?? '-'}</div>
                    <div><strong>action:</strong> {item.adLinkResult.action}</div>
                    <div><strong>reason:</strong> {item.adLinkResult.reason ?? '-'}</div>
                    <div><strong>error:</strong> {item.adLinkResult.error ?? '-'}</div>
                    <div>
                      <strong>chosenMlbId:</strong>{' '}
                      {item.adLinkResult.chosenMlbId ?? '-'}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {error && (
            <div style={{ padding: 14, border: '1px solid #fecaca', borderRadius: 8, backgroundColor: '#fef2f2', color: '#b91c1c' }}>
              {error}
            </div>
          )}

          <section style={sectionStyle}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={debugMode}
                onChange={(event) => setDebugMode(event.target.checked)}
              />
              Mostrar debug avançado
            </label>

            {debugMode && (
              <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                <details>
                  <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Matching Stats</summary>
                  <pre style={{ overflow: 'auto', padding: 12, backgroundColor: '#f8fafc' }}>
{JSON.stringify(analysisResult?.matchingStats ?? null, null, 2)}
                  </pre>
                </details>
                <details>
                  <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Compare Debug</summary>
                  <pre style={{ overflow: 'auto', padding: 12, backgroundColor: '#f8fafc' }}>
{JSON.stringify(analysisResult?.compareDebugUpdates ?? [], null, 2)}
                  </pre>
                </details>
                <details>
                  <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Preview JSON</summary>
                  <pre style={{ overflow: 'auto', padding: 12, backgroundColor: '#f8fafc' }}>
{JSON.stringify(analysisResult?.previewItems ?? [], null, 2)}
                  </pre>
                </details>
                <details>
                  <summary style={{ cursor: 'pointer', fontWeight: 700 }}>ExecutionPlan JSON</summary>
                  <pre style={{ overflow: 'auto', padding: 12, backgroundColor: '#f8fafc' }}>
{JSON.stringify(analysisResult?.executionPlan ?? null, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
