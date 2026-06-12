'use client';

import React, { useState } from 'react';
import {
  authenticateMercadoLivreIntegration,
  MercadoLivreAuthenticationError,
  type MercadoLivreAuthenticationAttempt,
} from '../../../adapters/mercado-livre/mercadoLivreAuthAdapter';
import { supabaseMarketplaceAdAdapter } from '../../../adapters/supabase/supabaseMarketplaceAdAdapter';
import { AppNavigation } from '../../../components/AppNavigation';
import { resolveAdLink } from '../../../core/marketplace/ad-link/resolveAdLink';
import {
  executeAdLinkDecision,
  type ExecuteAdLinkDecisionResult,
} from '../../../core/marketplace/ad-registry/executeAdLinkDecision';
import type { AdLinkDecision } from '../../../types/adLink.types';
import type { ImportExecutionContext } from '../../../types/integration.types';
import type { ExistingInventoryItem } from '../../../types/inventory.types';

const sectionStyle: React.CSSProperties = {
  padding: 20,
  border: '1px solid #dbe2ea',
  borderRadius: 10,
  backgroundColor: '#fff',
  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontFamily: 'inherit',
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 16px',
  border: 0,
  borderRadius: 6,
  backgroundColor: '#2563eb',
  color: '#fff',
  fontWeight: 700,
};

const parsePiece = (
  json: string,
  pieceId: string,
  storeId: string
): ExistingInventoryItem => {
  const parsed: unknown = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('O JSON da peça deve ser um objeto.');
  }

  const piece = parsed as Record<string, unknown>;
  const resolvedId = pieceId.trim() || String(piece.id ?? '').trim();
  if (!resolvedId) {
    throw new Error('peca_id é obrigatório.');
  }

  return {
    ...piece,
    id: resolvedId,
    store_id: String(piece.store_id ?? storeId).trim(),
  } as ExistingInventoryItem;
};

const parseMlbIds = (value: string): string[] =>
  value.split(/[\s,;]+/).filter(Boolean);

const executionActionLabel = (
  action: ExecuteAdLinkDecisionResult['action']
): string => ({
  inserted: 'Inserted',
  updated: 'Updated',
  skipped: 'Skipped',
  conflict: 'Conflict',
  invalid: 'Invalid',
  failed: 'Failed',
})[action];

export default function AdLinkPage() {
  const [integrationId, setIntegrationId] = useState('');
  const [pieceId, setPieceId] = useState('');
  const [mlbIdsText, setMlbIdsText] = useState('');
  const [pieceJson, setPieceJson] = useState(
    JSON.stringify(
      {
        id: '',
        store_id: '',
        code: '',
        marketplace_name: '',
        mercado_libre_brasil_category_id: '',
      },
      null,
      2
    )
  );
  const [context, setContext] = useState<ImportExecutionContext | null>(null);
  const [decision, setDecision] = useState<AdLinkDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authAttempts, setAuthAttempts] = useState<
    MercadoLivreAuthenticationAttempt[]
  >([]);
  const [isLoadingIntegration, setIsLoadingIntegration] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [useLocalRegistry, setUseLocalRegistry] = useState(false);
  const [executionResult, setExecutionResult] =
    useState<ExecuteAdLinkDecisionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const clearDecision = () => {
    setDecision(null);
    setExecutionResult(null);
    setError(null);
  };

  const loadIntegration = async () => {
    setIsLoadingIntegration(true);
    setContext(null);
    setAuthAttempts([]);
    clearDecision();

    try {
      setContext(await authenticateMercadoLivreIntegration(integrationId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setAuthAttempts(
        caught instanceof MercadoLivreAuthenticationError
          ? caught.attempts
          : []
      );
    } finally {
      setIsLoadingIntegration(false);
    }
  };

  const executeLink = async () => {
    if (!context || !decision) return;

    const resolvedPieceId = pieceId.trim() || decision.pecaId;
    setIsExecuting(true);
    setExecutionResult(null);
    setError(null);

    try {
      setExecutionResult(
        await executeAdLinkDecision({
          decision,
          context,
          pecaId: resolvedPieceId,
          adRegistryAdapter: supabaseMarketplaceAdAdapter,
        })
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsExecuting(false);
    }
  };

  const resolveLink = async () => {
    if (!context) return;

    setIsResolving(true);
    clearDecision();

    try {
      const piece = parsePiece(pieceJson, pieceId, context.storeId);
      setDecision(
        await resolveAdLink({
          peca: piece,
          context,
          mlbIds: parseMlbIds(mlbIdsText),
        }, useLocalRegistry ? supabaseMarketplaceAdAdapter : undefined)
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsResolving(false);
    }
  };

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
      <div style={{ width: '100%', maxWidth: 1100, margin: '0 auto' }}>
        <AppNavigation />

        <header style={{ marginBottom: 24 }}>
          <div style={{ color: '#2563eb', fontSize: 13, fontWeight: 700 }}>
            Marketplace / Ad Link Resolver
          </div>
          <h1 style={{ margin: '6px 0 8px' }}>Resolver vínculo de anúncio</h1>
          <p style={{ margin: 0, color: '#475569' }}>
            Análise somente leitura. Nenhuma peça ou anúncio será alterado.
          </p>
        </header>

        <div style={{ display: 'grid', gap: 18 }}>
          <section style={sectionStyle}>
            <h2 style={{ marginTop: 0 }}>1. Integração</h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: 12,
                alignItems: 'end',
              }}
            >
              <label>
                <span style={{ display: 'block', marginBottom: 7 }}>
                  integration_id
                </span>
                <input
                  value={integrationId}
                  onChange={(event) => {
                    setIntegrationId(event.target.value);
                    setContext(null);
                    clearDecision();
                  }}
                  disabled={isLoadingIntegration || isResolving}
                  style={inputStyle}
                />
              </label>
              <button
                type="button"
                onClick={() => void loadIntegration()}
                disabled={
                  integrationId.trim() === '' ||
                  isLoadingIntegration ||
                  isResolving
                }
                style={{
                  ...buttonStyle,
                  opacity:
                    integrationId.trim() === '' || isLoadingIntegration
                      ? 0.55
                      : 1,
                }}
              >
                {isLoadingIntegration ? 'Carregando...' : 'Carregar integração'}
              </button>
            </div>

            {context && (
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: '#eff6ff',
                }}
              >
                <strong>Store:</strong> {context.storeId}
                {' | '}
                <strong>Canal:</strong> {context.channel}
                {' | '}
                <strong>User ID:</strong> {context.marketplace?.userId ?? '-'}
                {' | '}
                <strong>Token:</strong>{' '}
                {context.marketplace?.accessToken ? 'presente' : 'ausente'}
              </div>
            )}
          </section>

          <section style={sectionStyle}>
            <h2 style={{ marginTop: 0 }}>2. Entrada</h2>
            <div style={{ display: 'grid', gap: 14 }}>
              <label>
                <span style={{ display: 'block', marginBottom: 7 }}>peca_id</span>
                <input
                  value={pieceId}
                  onChange={(event) => {
                    setPieceId(event.target.value);
                    clearDecision();
                  }}
                  style={inputStyle}
                />
              </label>

              <label>
                <span style={{ display: 'block', marginBottom: 7 }}>
                  mlb_ids
                </span>
                <textarea
                  value={mlbIdsText}
                  onChange={(event) => {
                    setMlbIdsText(event.target.value);
                    clearDecision();
                  }}
                  rows={5}
                  placeholder="MLB123&#10;MLB456"
                  style={inputStyle}
                />
              </label>

              <label>
                <span style={{ display: 'block', marginBottom: 7 }}>
                  JSON da peça
                </span>
                <textarea
                  value={pieceJson}
                  onChange={(event) => {
                    setPieceJson(event.target.value);
                    clearDecision();
                  }}
                  rows={14}
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                />
              </label>

              <button
                type="button"
                onClick={() => void resolveLink()}
                disabled={!context || isResolving || isLoadingIntegration || isExecuting}
                style={{
                  ...buttonStyle,
                  width: 'fit-content',
                  backgroundColor: '#15803d',
                  opacity: !context || isResolving ? 0.55 : 1,
                }}
              >
                {isResolving ? 'Resolvendo...' : 'Resolver vínculo'}
              </button>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: 'fit-content',
                }}
              >
                <input
                  type="checkbox"
                  checked={useLocalRegistry}
                  onChange={(event) => {
                    setUseLocalRegistry(event.target.checked);
                    clearDecision();
                  }}
                  disabled={isResolving || isExecuting}
                />
                Consultar registry local
              </label>
            </div>
          </section>

          {error && (
            <section
              style={{
                ...sectionStyle,
                borderColor: '#fecaca',
                backgroundColor: '#fef2f2',
                color: '#b91c1c',
              }}
            >
              <strong>Erro:</strong> {error}
              {authAttempts.length > 0 && (
                <details style={{ marginTop: 10 }}>
                  <summary>Detalhes técnicos</summary>
                  <pre style={{ overflow: 'auto' }}>
                    {JSON.stringify(authAttempts, null, 2)}
                  </pre>
                </details>
              )}
            </section>
          )}

          {decision && (
            <>
              <section style={sectionStyle}>
                <h2 style={{ marginTop: 0 }}>3. Decisão</h2>
                <p><strong>Action:</strong> {decision.action}</p>
                <p><strong>Motivo principal:</strong> {decision.reason}</p>
                <p><strong>chosenMlbId:</strong> {decision.chosenMlbId ?? '-'}</p>
                <p>
                  <strong>Score auxiliar:</strong>{' '}
                  {decision.chosenCandidate?.score ?? '-'}
                </p>
                <div>
                  <strong>Critérios auxiliares do score:</strong>
                  <ul>
                    {decision.chosenCandidate?.scoreDetails.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                </div>
                <p>
                  <strong>Candidatos válidos:</strong>{' '}
                  {decision.candidates.length}
                </p>
                {decision.candidates.map((candidate) => (
                  <div
                    key={candidate.mlbId}
                    style={{
                      marginTop: 8,
                      padding: 10,
                      border:
                        candidate.item?.status?.toLowerCase() === 'active'
                          ? '1px solid #bbf7d0'
                          : '1px solid #fde68a',
                      borderRadius: 6,
                      backgroundColor:
                        candidate.item?.status?.toLowerCase() === 'active'
                          ? '#f0fdf4'
                          : '#fffbeb',
                    }}
                  >
                    <strong>{candidate.mlbId}</strong>
                    {' | '}
                    Score auxiliar: {candidate.score}
                    {' | '}
                    Status: {candidate.item?.status ?? '-'}
                    {' | '}
                    Título: {candidate.item?.title ?? '-'}
                    {candidate.item?.status?.toLowerCase() !== 'active' && (
                      <div style={{ marginTop: 6, color: '#92400e' }}>
                        Anúncio válido. O status atual não impede o vínculo.
                      </div>
                    )}
                  </div>
                ))}
                <p>
                  <strong>Candidatos inválidos:</strong>{' '}
                  {decision.invalidCandidates.length}
                </p>
                {decision.invalidCandidates.map((candidate) => (
                  <div
                    key={candidate.mlbId}
                    style={{
                      marginTop: 8,
                      padding: 10,
                      border: '1px solid #fecaca',
                      borderRadius: 6,
                      backgroundColor: '#fef2f2',
                    }}
                  >
                    <strong>{candidate.mlbId}</strong>
                    {' | '}
                    HTTP: {candidate.errorStatus ?? '-'}
                    {' | '}
                    Cache: {candidate.useCache ? 'sim' : 'não'}
                    {' | '}
                    {candidate.errorMessage ?? 'erro desconhecido'}
                  </div>
                ))}
                <div style={{ marginTop: 18 }}>
                  <strong>Registros encontrados no registry:</strong>{' '}
                  {decision.registryRecords.length}
                  {decision.registryRecords.map((record) => (
                    <div
                      key={record.id}
                      style={{
                        marginTop: 8,
                        padding: 10,
                        border: '1px solid #bfdbfe',
                        borderRadius: 6,
                        backgroundColor: '#eff6ff',
                      }}
                    >
                      <div><strong>Ad ID:</strong> {record.id}</div>
                      <div><strong>MLB:</strong> {record.mlbId}</div>
                      <div><strong>Peça vinculada:</strong> {record.pecaId ?? '-'}</div>
                      <div><strong>Duplicado:</strong> {record.isDuplicate ? 'sim' : 'não'}</div>
                    </div>
                  ))}
                </div>
                {decision.action === 'conflict' &&
                  decision.registryRecords
                    .filter((record) => record.pecaId !== decision.pecaId)
                    .map((record) => (
                      <div
                        key={`conflict-${record.id}`}
                        style={{
                          marginTop: 12,
                          padding: 12,
                          border: '1px solid #fecaca',
                          borderRadius: 6,
                          backgroundColor: '#fef2f2',
                          color: '#991b1b',
                        }}
                      >
                        <strong>Conflito no registry</strong>
                        <div>Peça existente: {record.pecaId ?? '-'}</div>
                        <div>Ad ID existente: {record.id}</div>
                      </div>
                    ))}
                <div>
                  <strong>Warnings:</strong>
                  {decision.warnings.length === 0 ? (
                    <span> nenhum</span>
                  ) : (
                    <ul>
                      {decision.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void executeLink()}
                  disabled={
                    isExecuting ||
                    executionResult !== null ||
                    !(
                      decision.action === 'insert_new_ad' ||
                      decision.action === 'link_existing_ad'
                    )
                  }
                  style={{
                    ...buttonStyle,
                    marginTop: 18,
                    backgroundColor: '#7c3aed',
                    opacity:
                      isExecuting ||
                      executionResult !== null ||
                      !(
                        decision.action === 'insert_new_ad' ||
                        decision.action === 'link_existing_ad'
                      )
                        ? 0.55
                        : 1,
                  }}
                >
                  {isExecuting
                    ? 'Executando...'
                    : 'Executar vínculo no registry'}
                </button>
              </section>

              {executionResult && (
                <section
                  style={{
                    ...sectionStyle,
                    borderColor:
                      executionResult.action === 'failed'
                        ? '#fecaca'
                        : '#bbf7d0',
                    backgroundColor:
                      executionResult.action === 'failed'
                        ? '#fef2f2'
                        : '#f0fdf4',
                  }}
                >
                  <h2 style={{ marginTop: 0 }}>4. Resultado da execução</h2>
                  <p>
                    <strong>Resultado:</strong>{' '}
                    {executionActionLabel(executionResult.action)}
                  </p>
                  <p><strong>Ad ID:</strong> {executionResult.adId ?? '-'}</p>
                  <p><strong>MLB:</strong> {executionResult.mlbId ?? '-'}</p>
                  <p><strong>Mensagem:</strong> {executionResult.message}</p>
                  {executionResult.error && (
                    <p style={{ color: '#b91c1c' }}>
                      <strong>Erro:</strong> {executionResult.error}
                    </p>
                  )}
                  {(executionResult.action === 'inserted' ||
                    executionResult.action === 'updated') && (
                    <p style={{ color: '#166534', fontWeight: 700 }}>
                      Execute a resolução novamente para confirmar que agora o
                      anúncio aparece como link_existing_ad.
                    </p>
                  )}
                </section>
              )}

              <section style={sectionStyle}>
                <details>
                  <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
                    JSON completo
                  </summary>
                  <pre
                    style={{
                      overflow: 'auto',
                      maxHeight: 600,
                      padding: 12,
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    {JSON.stringify(decision, null, 2)}
                  </pre>
                </details>
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
