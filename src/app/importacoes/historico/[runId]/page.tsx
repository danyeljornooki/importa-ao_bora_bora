'use client'

import Link from 'next/link';
import { useParams } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import {
  PendingExport,
  RunItemsTable,
  RunSummary,
} from '../../../../components/import-history';
import { AppNavigation } from '../../../../components/AppNavigation';
import { supabaseImportHistoryAdapter } from '../../../../adapters/supabase/supabaseImportHistoryAdapter';
import type {
  GetImportRunItemsInput,
  GetImportRunItemsResult,
  ImportHistoryAction,
  ImportRun,
} from '../../../../types/importHistory.types';

type ItemFilter = 'all' | 'create' | 'update' | 'skip' | 'conflict' | 'invalid' | 'failed';

const EMPTY_ITEMS: GetImportRunItemsResult = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 50,
};

const filterLabels: Array<[ItemFilter, string]> = [
  ['all', 'Todos'],
  ['create', 'Created'],
  ['update', 'Updated'],
  ['skip', 'Skipped'],
  ['conflict', 'Conflict'],
  ['invalid', 'Invalid'],
  ['failed', 'Failed'],
];

const itemQuery = (filter: ItemFilter, page: number): GetImportRunItemsInput => ({
  page,
  pageSize: 50,
  action: filter !== 'all' && filter !== 'failed'
    ? filter as ImportHistoryAction
    : undefined,
  executionStatus: filter === 'failed' ? 'failed' : undefined,
});

const Metrics = ({ run }: { run: ImportRun }) => {
  const values = [
    ['Creates', run.creates],
    ['Updates', run.updates],
    ['Skipped', run.skipped],
    ['Conflicts', run.conflicts],
    ['Invalid', run.invalid],
    ['Failed', run.failed],
    ['Warnings', run.warningsCount],
  ];

  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
      {values.map(([label, value]) => (
        <div key={label} style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
          <div style={{ color: '#64748b', fontSize: 12, textTransform: 'uppercase' }}>{label}</div>
          <div style={{ marginTop: 4, fontSize: 24, fontWeight: 700 }}>{value}</div>
        </div>
      ))}
    </section>
  );
};

export default function ImportRunDetailsPage() {
  const params = useParams<{ runId: string }>();
  const runId = Array.isArray(params.runId) ? params.runId[0] : params.runId;
  const [run, setRun] = useState<ImportRun | null>(null);
  const [itemsResult, setItemsResult] = useState<GetImportRunItemsResult>(EMPTY_ITEMS);
  const [filter, setFilter] = useState<ItemFilter>('all');
  const [page, setPage] = useState<number>(1);
  const [loadingRun, setLoadingRun] = useState<boolean>(true);
  const [loadingItems, setLoadingItems] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [showJson, setShowJson] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadRun = useCallback(async () => {
    if (!runId) return;
    setLoadingRun(true);
    setError(null);
    try {
      setRun(await supabaseImportHistoryAdapter.getRun(runId));
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setLoadingRun(false);
    }
  }, [runId]);

  const loadItems = useCallback(async () => {
    if (!runId) return;
    setLoadingItems(true);
    setError(null);
    try {
      setItemsResult(
        await supabaseImportHistoryAdapter.getRunItems(runId, itemQuery(filter, page))
      );
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setLoadingItems(false);
    }
  }, [filter, page, runId]);

  useEffect(() => {
    void loadRun();
  }, [loadRun]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const exportPending = async () => {
    if (!runId) return;
    setExporting(true);
    setError(null);

    try {
      const csv = await supabaseImportHistoryAdapter.exportPending(runId);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `import-run-${runId}-pendencias.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(itemsResult.total / itemsResult.pageSize));

  return (
    <main style={{ minHeight: '100vh', padding: '32px 20px 56px', background: '#f1f5f9', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 1400, margin: '0 auto' }}>
        <AppNavigation />
        <header style={{ marginBottom: 22 }}>
          <div style={{ color: '#2563eb', fontSize: 13, fontWeight: 700 }}>Importações / Histórico / Run</div>
          <h1 style={{ margin: '6px 0 8px' }}>Detalhes da Importação</h1>
          <Link href="/importacoes/historico">Voltar ao histórico</Link>
        </header>

        {error && (
          <div style={{ marginBottom: 16, padding: 14, border: '1px solid #fecaca', borderRadius: 8, background: '#fef2f2', color: '#b91c1c' }}>
            {error}
          </div>
        )}

        {loadingRun && <div>Carregando run...</div>}
        {!loadingRun && !run && <div>Run não encontrada.</div>}

        {run && (
          <div style={{ display: 'grid', gap: 18 }}>
            <RunSummary run={run} showJson={showJson} onToggleJson={() => setShowJson((current) => !current)} />
            <Metrics run={run} />

            <section style={{ padding: 20, border: '1px solid #dbe2ea', borderRadius: 10, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0 }}>Itens</h2>
                <PendingExport loading={exporting} onExport={() => void exportPending()} />
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
                {filterLabels.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setFilter(value);
                      setPage(1);
                    }}
                    style={{
                      padding: '8px 12px',
                      fontWeight: filter === value ? 700 : 400,
                      background: filter === value ? '#dbeafe' : '#fff',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {loadingItems ? (
                <div>Carregando itens...</div>
              ) : (
                <RunItemsTable items={itemsResult.items} showJson={showJson} />
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                <button type="button" disabled={loadingItems || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  Anterior
                </button>
                <span>Página {page} de {totalPages} ({itemsResult.total} itens)</span>
                <button type="button" disabled={loadingItems || page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                  Próxima
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
