'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseReviewAdapter } from '../../../adapters/supabase/supabaseReviewAdapter';
import { AppNavigation } from '../../../components/AppNavigation';
import type { ImportRun } from '../../../types/importHistory.types';
import type {
  ReviewItem,
  ReviewItemType,
  ReviewSummary,
} from '../../../types/review.types';

const EMPTY_SUMMARY: ReviewSummary = {
  total: 0,
  pending: 0,
  warnings: 0,
  errors: 0,
  byType: {},
};

const typeLabels: Record<ReviewItemType, string> = {
  possible_duplicate: 'Possível duplicada',
  ad_pending: 'Anúncio pendente',
  ad_no_access: 'Anúncio sem acesso',
  ad_not_found: 'Anúncio não encontrado',
  ad_conflict: 'Conflito de anúncio',
  no_image: 'Sem imagem',
  location_pending: 'Localização pendente',
  invalid_row: 'Linha inválida',
  failed_row: 'Falha',
  warning: 'Warning',
};

const csvCell = (value: unknown): string =>
  `"${String(value ?? '').replace(/"/g, '""')}"`;

const exportReviewCsv = (runId: string, items: ReviewItem[]) => {
  const fields: Array<keyof ReviewItem> = [
    'runId',
    'row',
    'type',
    'severity',
    'title',
    'message',
    'code',
    'idInt',
    'mlbId',
    'pecaId',
    'targetId',
  ];
  const lines = items.map((item) =>
    fields.map((field) => csvCell(item[field])).join(',')
  );
  const csv = [fields.join(','), ...lines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `revisao-${runId}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const nestedNumber = (value: unknown, path: string[]): number => {
  let current = value;
  for (const field of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return 0;
    }
    current = (current as Record<string, unknown>)[field];
  }
  const parsed = Number(current);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (value: string): string =>
  value ? new Date(value).toLocaleString('pt-BR') : '-';

type LocalTypeFilter = ReviewItemType | 'all' | 'failures';
type SeverityFilter = ReviewItem['severity'] | 'all';

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
};

export default function ReviewRunPage() {
  const params = useParams<{ runId: string }>();
  const runId = Array.isArray(params.runId) ? params.runId[0] : params.runId;
  const [run, setRun] = useState<ImportRun | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>(EMPTY_SUMMARY);
  const [typeFilter, setTypeFilter] = useState<LocalTypeFilter>('all');
  const [severityFilter, setSeverityFilter] =
    useState<SeverityFilter>('all');
  const [textFilter, setTextFilter] = useState('');
  const [rowFilter, setRowFilter] = useState('');
  const [mlbFilter, setMlbFilter] = useState('');
  const [codeFilter, setCodeFilter] = useState('');
  const [showImageItems, setShowImageItems] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [jsonIds, setJsonIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const loadReview = useCallback(async () => {
    if (!runId) return;
    setLoading(true);
    setError(null);
    try {
      const [nextRun, result] = await Promise.all([
        supabaseReviewAdapter.getReviewRun(runId),
        supabaseReviewAdapter.getReviewItems(runId),
      ]);
      setRun(nextRun);
      setItems(result.items);
      setSummary(result.summary);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : String(caughtError)
      );
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  const filteredItems = useMemo(() => {
    const normalizedText = textFilter.trim().toLowerCase();
    const normalizedRow = rowFilter.trim();
    const normalizedMlb = mlbFilter.trim().toLowerCase();
    const normalizedCode = codeFilter.trim().toLowerCase();

    return items
      .filter((item) => showImageItems || item.type !== 'no_image')
      .filter((item) =>
        typeFilter === 'all' ||
        (typeFilter === 'failures' &&
          ['failed_row', 'invalid_row'].includes(item.type)) ||
        item.type === typeFilter
      )
      .filter((item) =>
        severityFilter === 'all' || item.severity === severityFilter
      )
      .filter((item) =>
        !normalizedRow || String(item.row) === normalizedRow
      )
      .filter((item) =>
        !normalizedMlb ||
        String(item.mlbId ?? '').toLowerCase().includes(normalizedMlb)
      )
      .filter((item) =>
        !normalizedCode ||
        String(item.code ?? '').toLowerCase().includes(normalizedCode)
      )
      .filter((item) => {
        if (!normalizedText) return true;
        return [
          item.title,
          item.message,
          item.code,
          item.mlbId,
          item.pecaId,
          item.targetId,
          typeLabels[item.type],
        ].some((value) =>
          String(value ?? '').toLowerCase().includes(normalizedText)
        );
      })
      .map((item): ReviewItem => ({
        ...item,
        status: reviewedIds.has(item.id) ? 'reviewed' : item.status,
      }));
  }, [
    codeFilter,
    items,
    mlbFilter,
    reviewedIds,
    rowFilter,
    severityFilter,
    showImageItems,
    textFilter,
    typeFilter,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    codeFilter,
    mlbFilter,
    pageSize,
    rowFilter,
    severityFilter,
    showImageItems,
    textFilter,
    typeFilter,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginatedItems = filteredItems.slice(pageStart, pageStart + pageSize);
  const rangeStart = filteredItems.length === 0 ? 0 : pageStart + 1;
  const rangeEnd = Math.min(pageStart + pageSize, filteredItems.length);
  const hasExplicitFilter =
    typeFilter !== 'all' ||
    severityFilter !== 'all' ||
    textFilter.trim() !== '' ||
    rowFilter.trim() !== '' ||
    mlbFilter.trim() !== '' ||
    codeFilter.trim() !== '' ||
    showImageItems;
  const exportItems = hasExplicitFilter ? filteredItems : items;

  const copyValue = async (label: string, value?: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(`${label} copiado`);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(`Não foi possível copiar ${label}`);
    }
  };

  const toggleSetValue = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string
  ) => setter((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const filterCards: Array<{
    label: string;
    value: number;
    filter: LocalTypeFilter;
  }> = [
    {
      label: 'Duplicadas',
      value: summary.byType.possible_duplicate ?? 0,
      filter: 'possible_duplicate',
    },
    {
      label: 'MLB sem acesso',
      value: summary.byType.ad_no_access ?? 0,
      filter: 'ad_no_access',
    },
    {
      label: 'MLB não encontrado',
      value: summary.byType.ad_not_found ?? 0,
      filter: 'ad_not_found',
    },
    {
      label: 'Sem imagem',
      value: summary.byType.no_image ?? 0,
      filter: 'no_image',
    },
    {
      label: 'Localização pendente',
      value: summary.byType.location_pending ?? 0,
      filter: 'location_pending',
    },
    {
      label: 'Falhas',
      value:
        (summary.byType.failed_row ?? 0) +
        (summary.byType.invalid_row ?? 0),
      filter: 'failures',
    },
  ];

  const applyCardFilter = (filter: LocalTypeFilter) => {
    setTypeFilter(filter);
    if (filter === 'no_image') {
      setShowImageItems(true);
    }
  };

  const runMetrics = run ? [
    ['Created', run.creates],
    ['Updated', run.updates],
    ['Skipped', run.skipped],
    ['Failed', run.failed],
    [
      'Complement Pending',
      nestedNumber(run.summary, ['commit', 'complementPending']) ||
      nestedNumber(run.summary, ['complements', 'complementPending']),
    ],
  ] : [];

  return (
    <main style={{ minHeight: '100vh', padding: '32px 20px 56px', background: '#f1f5f9', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 1600, margin: '0 auto' }}>
        <AppNavigation />
        <header style={{ marginBottom: 22 }}>
          <div style={{ color: '#7c3aed', fontSize: 13, fontWeight: 700 }}>
            Central de Revisão / Run
          </div>
          <h1 style={{ margin: '6px 0 8px' }}>Revisão da Importação</h1>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Link href="/revisao">Voltar à Central</Link>
            {runId && (
              <Link href={`/importacoes/historico/${runId}`}>
                Abrir no histórico
              </Link>
            )}
          </div>
        </header>

        {error && (
          <div style={{ marginBottom: 16, padding: 14, border: '1px solid #fecaca', borderRadius: 8, background: '#fef2f2', color: '#b91c1c' }}>
            {error}
          </div>
        )}
        {copied && (
          <div style={{ marginBottom: 16, padding: 10, borderRadius: 8, background: '#eff6ff', color: '#1d4ed8' }}>
            {copied}
          </div>
        )}
        {loading && <div>Carregando revisão...</div>}
        {!loading && !run && <div>Run não encontrada.</div>}

        {run && (
          <div style={{ display: 'grid', gap: 18 }}>
            <section style={{ padding: 18, border: '1px solid #dbe2ea', borderRadius: 10, background: '#fff' }}>
              <h2 style={{ marginTop: 0 }}>Resumo da run</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                {[
                  ['Arquivo', run.fileName ?? '-'],
                  ['Loja', run.storeId],
                  ['Data', formatDate(run.createdAt)],
                  ['Status', run.status],
                ].map(([label, value]) => (
                  <div key={label}>
                    <strong>{label}:</strong> {value}
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 16 }}>
                {runMetrics.map(([label, value]) => (
                  <div key={label} style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    <div style={{ color: '#64748b', fontSize: 12 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              {filterCards.map((card) => (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => applyCardFilter(card.filter)}
                  style={{
                    padding: 14,
                    border: typeFilter === card.filter
                      ? '2px solid #7c3aed'
                      : '1px solid #e2e8f0',
                    borderRadius: 8,
                    background: '#fff',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ color: '#64748b', fontSize: 12, textTransform: 'uppercase' }}>{card.label}</div>
                  <div style={{ marginTop: 4, fontSize: 24, fontWeight: 700 }}>{card.value}</div>
                </button>
              ))}
            </section>

            <section style={{ padding: 18, border: '1px solid #dbe2ea', borderRadius: 10, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0 }}>Pendências operacionais</h2>
                <button type="button" onClick={() => exportReviewCsv(run.id, exportItems)}>
                  Exportar revisão CSV
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, margin: '16px 0' }}>
                <label>
                  <span>Tipo</span>
                  <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as LocalTypeFilter)} style={inputStyle}>
                    <option value="all">Todos</option>
                    <option value="failures">Falhas e inválidas</option>
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Severidade</span>
                  <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)} style={inputStyle}>
                    <option value="all">Todas</option>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                  </select>
                </label>
                <label>
                  <span>Texto livre</span>
                  <input value={textFilter} onChange={(event) => setTextFilter(event.target.value)} placeholder="Título, mensagem, peça..." style={inputStyle} />
                </label>
                <label>
                  <span>Linha</span>
                  <input type="number" min="1" value={rowFilter} onChange={(event) => setRowFilter(event.target.value)} style={inputStyle} />
                </label>
                <label>
                  <span>MLB</span>
                  <input value={mlbFilter} onChange={(event) => setMlbFilter(event.target.value)} style={inputStyle} />
                </label>
                <label>
                  <span>Código</span>
                  <input value={codeFilter} onChange={(event) => setCodeFilter(event.target.value)} style={inputStyle} />
                </label>
                <label>
                  <span>Itens por página</span>
                  <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} style={inputStyle}>
                    {[50, 100, 250, 500].map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={showImageItems}
                    onChange={(event) => setShowImageItems(event.target.checked)}
                  />
                  Mostrar pendências informativas de imagem
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter('all');
                    setSeverityFilter('all');
                    setTextFilter('');
                    setRowFilter('');
                    setMlbFilter('');
                    setCodeFilter('');
                    setShowImageItems(false);
                  }}
                >
                  Limpar filtros
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                <strong>
                  Mostrando {rangeStart}-{rangeEnd} de {filteredItems.length} pendências
                </strong>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                    Anterior
                  </button>
                  <span>Página {safePage} de {totalPages}</span>
                  <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                    Próxima
                  </button>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1450 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                      {['Linha', 'Tipo', 'Severidade', 'Título', 'Mensagem', 'Código', 'MLB', 'Peça', 'Status', 'Ações'].map((heading) => (
                        <th key={heading} style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.length === 0 && (
                      <tr>
                        <td colSpan={10} style={{ padding: 20, color: '#64748b' }}>
                          Nenhuma pendência para o filtro selecionado.
                        </td>
                      </tr>
                    )}
                    {paginatedItems.map((item) => (
                      <React.Fragment key={item.id}>
                        <tr>
                          <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{item.row}</td>
                          <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{typeLabels[item.type]}</td>
                          <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{item.severity}</td>
                          <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{item.title}</td>
                          <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0', maxWidth: 360 }}>{item.message}</td>
                          <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{item.code ?? '-'}</td>
                          <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{item.mlbId ?? '-'}</td>
                          <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{item.pecaId ?? '-'}</td>
                          <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{item.status}</td>
                          <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <button type="button" disabled={!item.mlbId} onClick={() => void copyValue('MLB', item.mlbId)}>Copiar MLB</button>
                              <button type="button" disabled={!item.pecaId} onClick={() => void copyValue('pecaId', item.pecaId)}>Copiar pecaId</button>
                              <button type="button" onClick={() => toggleSetValue(setJsonIds, item.id)}>Mostrar JSON</button>
                              <button type="button" onClick={() => toggleSetValue(setReviewedIds, item.id)}>
                                {item.status === 'reviewed' ? 'Desmarcar revisão' : 'Marcar revisado'}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {jsonIds.has(item.id) && (
                          <tr>
                            <td colSpan={10} style={{ padding: 12, background: '#f8fafc' }}>
                              <pre style={{ margin: 0, maxHeight: 420, overflow: 'auto' }}>
                                {JSON.stringify(item.rawItem, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 14 }}>
                <span>
                  Mostrando {rangeStart}-{rangeEnd} de {filteredItems.length} pendências
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                    Anterior
                  </button>
                  <span>Página {safePage} de {totalPages}</span>
                  <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                    Próxima
                  </button>
                </div>
              </div>
              <p style={{ color: '#64748b', fontSize: 13 }}>
                Status revisado é mantido apenas nesta sessão da página e não
                altera o banco.
              </p>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
