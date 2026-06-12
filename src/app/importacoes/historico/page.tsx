'use client'

import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';
import {
  RunFilters,
  RunStats,
  RunTable,
} from '../../../components/import-history';
import { AppNavigation } from '../../../components/AppNavigation';
import { supabaseImportHistoryAdapter } from '../../../adapters/supabase/supabaseImportHistoryAdapter';
import type {
  ImportRunFilters,
  ListImportRunsResult,
} from '../../../types/importHistory.types';

const EMPTY_RESULT: ListImportRunsResult = {
  runs: [],
  total: 0,
  page: 1,
  pageSize: 50,
  stats: {
    totalRuns: 0,
    totalCreates: 0,
    totalUpdates: 0,
    totalSkipped: 0,
    totalConflicts: 0,
    totalInvalid: 0,
    totalFailed: 0,
  },
};

export default function ImportHistoryPage() {
  const [draftFilters, setDraftFilters] = useState<ImportRunFilters>({});
  const [filters, setFilters] = useState<ImportRunFilters>({});
  const [result, setResult] = useState<ListImportRunsResult>(EMPTY_RESULT);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextResult = await supabaseImportHistoryAdapter.listRuns({
        page,
        pageSize: 50,
        filters,
      });
      setResult(nextResult);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <main style={{ minHeight: '100vh', padding: '32px 20px 56px', background: '#f1f5f9', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 1500, margin: '0 auto' }}>
        <AppNavigation />
        <header style={{ marginBottom: 22 }}>
          <div style={{ color: '#2563eb', fontSize: 13, fontWeight: 700 }}>Importações / Histórico</div>
          <h1 style={{ margin: '6px 0 8px' }}>Histórico de Importações</h1>
          <div style={{ display: 'flex', gap: 14 }}>
            <Link href="/importacoes/pecas">Nova importação de peças</Link>
          </div>
        </header>

        <div style={{ display: 'grid', gap: 18 }}>
          <RunStats stats={result.stats} />
          <RunFilters
            value={draftFilters}
            loading={loading}
            onChange={setDraftFilters}
            onApply={() => {
              setPage(1);
              setFilters({ ...draftFilters });
            }}
            onClear={() => {
              setDraftFilters({});
              setFilters({});
              setPage(1);
            }}
          />

          {error && (
            <div style={{ padding: 14, border: '1px solid #fecaca', borderRadius: 8, background: '#fef2f2', color: '#b91c1c' }}>
              {error}
            </div>
          )}

          <section style={{ border: '1px solid #dbe2ea', borderRadius: 10, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 18, borderBottom: '1px solid #e2e8f0' }}>
              <strong>Runs encontradas: {result.total}</strong>
              {loading && <span>Carregando...</span>}
            </div>
            <RunTable runs={result.runs} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </button>
              <span>Página {page} de {totalPages}</span>
              <button
                type="button"
                disabled={loading || page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Próxima
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
