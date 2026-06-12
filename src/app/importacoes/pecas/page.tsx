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

  const clearResults = () => {
    setAnalysisResult(null);
    setExecutionResult(null);
    setHasAnalyzed(false);
    setHasExecuted(false);
    setError(null);
    setExecutionProgress(0);
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

    try {
      const result = await runImport(await selectedFile.arrayBuffer(), {
        storeId: executionContext.storeId,
        adapter: supabaseInventoryAdapter,
        integrationId: executionContext.integrationId,
        debugMatching: debugMode,
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
  const complementEligibleActions =
    analysisResult?.executionPlan.actions.filter((action) =>
      action.type === 'create' ||
      action.type === 'update' ||
      action.type === 'skip'
    ).length ?? 0;
  const canExecute =
    hasAnalyzed &&
    !hasExecuted &&
    executionContext !== null &&
    complementEligibleActions > 0 &&
    !isAnalyzing &&
    !isExecuting;
  const pendingAdItems =
    executionResult?.rows.filter((row) =>
      row.adLink &&
      ['pending', 'failed', 'conflict', 'invalid'].includes(row.adLink.action)
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
                  setSelectedFile(event.target.files?.[0] ?? null);
                  clearResults();
                }}
              />
            </label>
            <div style={{ marginTop: 12, color: selectedFile ? '#0f172a' : '#64748b' }}>
              Arquivo selecionado: <strong>{selectedFile?.name ?? 'nenhum arquivo'}</strong>
            </div>
          </section>

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
                  <Metric label="Warnings" value={summary.warnings} />
                </div>
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

            {hasAnalyzed && complementEligibleActions === 0 && (
              <div style={{ marginTop: 10, color: '#92400e' }}>
                Nenhuma ação executável. Todos os itens estão iguais ou pendentes.
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
                <Metric label="Created" value={executionResult.persistResult.created} />
                <Metric label="Updated" value={executionResult.persistResult.updated} />
                <Metric label="Skipped" value={executionResult.persistResult.skipped} />
                <Metric label="Failed" value={executionResult.persistResult.failed} />
                <Metric
                  label="Pending"
                  value={
                    executionResult.persistResult.conflicts +
                    executionResult.persistResult.invalid +
                    executionResult.persistResult.failed
                  }
                />
                <Metric
                  label="Complement Pending"
                  value={executionResult.complements.complementPending}
                />
              </div>
              <h3 style={{ marginBottom: 8 }}>Complementos</h3>
              <div style={{ display: 'grid', gap: 4 }}>
                <div>Anúncios vinculados: <strong>{executionResult.complements.linkedAds}</strong></div>
                <div>Anúncios pendentes: <strong>{executionResult.complements.pendingAds}</strong></div>
                <div>Anúncios com erro: <strong>{executionResult.complements.failedAds}</strong></div>
                <div>Imagens ML: <strong>{executionResult.complements.mlImages}</strong></div>
                <div>Imagens planilha: <strong>{executionResult.complements.sheetImages}</strong></div>
                <div>Sem imagem: <strong>{executionResult.complements.noImage}</strong></div>
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
                    <div><strong>pecaId:</strong> {item.part.pecaId ?? '-'}</div>
                    <div><strong>mlbId:</strong> {item.adLink?.mlbId ?? '-'}</div>
                    <div><strong>action:</strong> {item.adLink?.action ?? '-'}</div>
                    <div><strong>reason:</strong> {item.adLink?.reason ?? '-'}</div>
                    <div><strong>error:</strong> {item.adLink?.error ?? '-'}</div>
                    <div>
                      <strong>chosenMlbId:</strong>{' '}
                      {item.adLink?.chosenMlbId ?? '-'}
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
