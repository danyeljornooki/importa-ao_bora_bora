'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';
import { supabaseReviewAdapter } from '../../adapters/supabase/supabaseReviewAdapter';
import { AppNavigation } from '../../components/AppNavigation';
import type {
  ReviewFilters,
  ReviewItemType,
  ReviewRunsResult,
} from '../../types/review.types';

const EMPTY_RESULT: ReviewRunsResult = {
  runs: [],
  totalRuns: 0,
  summary: {
    total: 0,
    pending: 0,
    warnings: 0,
    errors: 0,
    byType: {},
  },
};

const reviewTypes: Array<[ReviewItemType | '', string]> = [
  ['', 'Todos os tipos'],
  ['possible_duplicate', 'Possíveis duplicadas'],
  ['ad_pending', 'MLB pendente'],
  ['ad_no_access', 'Anúncio sem acesso'],
  ['ad_not_found', 'Anúncio não encontrado'],
  ['ad_conflict', 'Conflito de anúncio'],
  ['no_image', 'Sem imagem'],
  ['invalid_row', 'Linha inválida'],
  ['failed_row', 'Falha'],
  ['warning', 'Warning'],
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '9px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
};

const cardStyle: React.CSSProperties = {
  padding: 14,
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  background: '#fff',
};

const count = (
  result: ReviewRunsResult,
  ...types: ReviewItemType[]
): number => types.reduce(
  (total, type) => total + (result.summary.byType[type] ?? 0),
  0
);

const runCount = (
  byType: Record<string, number>,
  ...types: ReviewItemType[]
): number => types.reduce(
  (total, type) => total + (byType[type] ?? 0),
  0
);

const formatDate = (value: string): string =>
  value ? new Date(value).toLocaleString('pt-BR') : '-';

interface TechnicalError {
  message: string;
  details: string | null;
  hint: string | null;
  code: string | null;
}

const errorField = (
  value: unknown,
  field: 'message' | 'details' | 'hint' | 'code'
): string | null => {
  if (!value || typeof value !== 'object') return null;
  const fieldValue = (value as Record<string, unknown>)[field];
  return fieldValue === null || fieldValue === undefined
    ? null
    : String(fieldValue);
};

const technicalError = (error: unknown): TechnicalError => ({
  message:
    error instanceof Error
      ? error.message
      : errorField(error, 'message') ?? String(error),
  details: errorField(error, 'details'),
  hint: errorField(error, 'hint'),
  code: errorField(error, 'code'),
});

export default function ReviewPage() {
  const [draftFilters, setDraftFilters] = useState<ReviewFilters>({});
  const [filters, setFilters] = useState<ReviewFilters>({});
  const [result, setResult] = useState<ReviewRunsResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<TechnicalError | null>(null);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await supabaseReviewAdapter.listReviewRuns(filters));
    } catch (caughtError) {
      setError(technicalError(caughtError));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const setField = (
    field: keyof ReviewFilters,
    value: string
  ) => setDraftFilters((current) => ({ ...current, [field]: value }));

  const cards = [
    ['Total de runs', result.totalRuns],
    ['Pendências totais', result.summary.total],
    ['Possíveis duplicadas', count(result, 'possible_duplicate')],
    [
      'MLB pendentes',
      count(
        result,
        'ad_pending',
        'ad_no_access',
        'ad_not_found',
        'ad_conflict'
      ),
    ],
    ['Sem imagem', count(result, 'no_image')],
    ['Falhas', count(result, 'failed_row', 'invalid_row')],
  ];

  return (
    <main style={{ minHeight: '100vh', padding: '32px 20px 56px', background: '#f1f5f9', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 1500, margin: '0 auto' }}>
        <AppNavigation />
        <header style={{ marginBottom: 22 }}>
          <div style={{ color: '#7c3aed', fontSize: 13, fontWeight: 700 }}>
            Operação / Exceções
          </div>
          <h1 style={{ margin: '6px 0 8px' }}>Central de Revisão</h1>
          <p style={{ margin: 0, color: '#475569' }}>
            Caixa de entrada operacional gerada pelo histórico das importações.
            Nenhuma ação desta tela altera dados reais.
          </p>
        </header>

        <div style={{ display: 'grid', gap: 18 }}>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {cards.map(([label, value]) => (
              <div key={label} style={cardStyle}>
                <div style={{ color: '#64748b', fontSize: 12, textTransform: 'uppercase' }}>{label}</div>
                <div style={{ marginTop: 4, fontSize: 24, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </section>

          <section style={{ padding: 18, border: '1px solid #dbe2ea', borderRadius: 10, background: '#fff' }}>
            <h2 style={{ marginTop: 0 }}>Filtros</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <label>
                <span>Run ID</span>
                <input value={draftFilters.runId ?? ''} onChange={(event) => setField('runId', event.target.value)} style={inputStyle} />
              </label>
              <label>
                <span>Loja / Store ID</span>
                <input value={draftFilters.storeId ?? ''} onChange={(event) => setField('storeId', event.target.value)} style={inputStyle} />
              </label>
              <label>
                <span>Arquivo</span>
                <input value={draftFilters.fileName ?? ''} onChange={(event) => setField('fileName', event.target.value)} style={inputStyle} />
              </label>
              <label>
                <span>Tipo de pendência</span>
                <select value={draftFilters.type ?? ''} onChange={(event) => setField('type', event.target.value)} style={inputStyle}>
                  {reviewTypes.map(([value, label]) => (
                    <option key={value || 'all'} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Data inicial</span>
                <input type="date" value={draftFilters.dateFrom ?? ''} onChange={(event) => setField('dateFrom', event.target.value)} style={inputStyle} />
              </label>
              <label>
                <span>Data final</span>
                <input type="date" value={draftFilters.dateTo ?? ''} onChange={(event) => setField('dateTo', event.target.value)} style={inputStyle} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button type="button" disabled={loading} onClick={() => setFilters({ ...draftFilters })}>
                Aplicar filtros
              </button>
              <button type="button" disabled={loading} onClick={() => {
                setDraftFilters({});
                setFilters({});
              }}>
                Limpar
              </button>
            </div>
          </section>

          {error && (
            <div style={{ padding: 14, border: '1px solid #fecaca', borderRadius: 8, background: '#fef2f2', color: '#b91c1c' }}>
              <strong>Falha ao carregar import_runs</strong>
              <div><strong>message:</strong> {error.message}</div>
              <div><strong>details:</strong> {error.details ?? '-'}</div>
              <div><strong>hint:</strong> {error.hint ?? '-'}</div>
              <div><strong>code:</strong> {error.code ?? '-'}</div>
            </div>
          )}

          <section style={{ border: '1px solid #dbe2ea', borderRadius: 10, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 18, borderBottom: '1px solid #e2e8f0' }}>
              <strong>Runs com pendências: {result.totalRuns}</strong>
              <span>{loading ? 'Carregando import_runs...' : 'Leitura somente'}</span>
            </div>
            {loading && (
              <div style={{ padding: 20, color: '#475569' }}>
                Carregando as últimas 50 runs...
              </div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1250 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                    {['Data', 'Arquivo', 'Loja', 'Status', 'Total linhas', 'Pendências', 'Duplicadas', 'MLB', 'Sem imagem', 'Falhas', 'Ação'].map((heading) => (
                      <th key={heading} style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!loading && !error && result.runs.length === 0 && (
                    <tr>
                      <td colSpan={11} style={{ padding: 20, color: '#64748b' }}>
                        Nenhuma run com pendências foi encontrada.
                      </td>
                    </tr>
                  )}
                  {!loading && result.runs.map(({ run, summary }) => (
                    <tr key={run.id}>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{formatDate(run.createdAt)}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{run.fileName ?? '-'}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{run.storeId}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{run.status}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{run.totalRows}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{summary.total}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{runCount(summary.byType, 'possible_duplicate')}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>
                        {runCount(summary.byType, 'ad_pending', 'ad_no_access', 'ad_not_found', 'ad_conflict')}
                      </td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{runCount(summary.byType, 'no_image')}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{runCount(summary.byType, 'failed_row', 'invalid_row')}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        <Link href={`/revisao/${run.id}`}>Ver revisão</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
