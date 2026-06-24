'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppNavigation } from '../../components/AppNavigation';
import { catalogPreviewAdapter } from '../../features/catalog-preview/catalogPreviewAdapter';
import { CatalogFilters } from '../../features/catalog-preview/components/CatalogFilters';
import { CatalogPartGridCard } from '../../features/catalog-preview/components/CatalogPartGridCard';
import { CatalogPartListItem } from '../../features/catalog-preview/components/CatalogPartListItem';
import type {
  CatalogPreviewFilters,
  CatalogPreviewListResult,
  CatalogViewMode,
} from '../../features/catalog-preview/types';

const initialFilters: CatalogPreviewFilters = {
  page: 1,
  pageSize: 10,
  stock: 'all',
  location: 'all',
  image: 'all',
  ad: 'all',
  sort: 'recent',
};

const emptyResult: CatalogPreviewListResult = {
  items: [],
  total: null,
  page: 1,
  pageSize: 10,
};

export default function CatalogPreviewPage() {
  const [draftFilters, setDraftFilters] = useState<CatalogPreviewFilters>(initialFilters);
  const [filters, setFilters] = useState<CatalogPreviewFilters>(initialFilters);
  const [viewMode, setViewMode] = useState<CatalogViewMode>('list');
  const [result, setResult] = useState<CatalogPreviewListResult>(emptyResult);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasStoreId = Boolean(filters.storeId?.trim());

  const loadParts = useCallback(async () => {
    if (!filters.storeId?.trim()) {
      setResult({ ...emptyResult, page: filters.page, pageSize: filters.pageSize });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setResult(await catalogPreviewAdapter.listCatalogPreviewParts(filters));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadParts();
  }, [loadParts]);

  const totalPages = useMemo(() => {
    if (result.total === null) return 1;
    return Math.max(1, Math.ceil(result.total / result.pageSize));
  }, [result.total, result.pageSize]);

  const changePage = (page: number) => {
    const next = { ...filters, page };
    setFilters(next);
    setDraftFilters(next);
  };

  return (
    <main style={{ minHeight: '100vh', padding: '32px 20px 56px', backgroundColor: '#eef4f8', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
      <div style={{ width: '100%', maxWidth: 1480, margin: '0 auto' }}>
        <AppNavigation />
        <header style={{ marginBottom: 20 }}>
          <div style={{ color: '#2563eb', fontSize: 13, fontWeight: 800 }}>Catálogo Preview / Read-only</div>
          <h1 style={{ margin: '6px 0 8px' }}>Catálogo Preview</h1>
          <p style={{ margin: 0, color: '#475569' }}>
            Visualização local das peças importadas no Supabase. Esta tela não edita, exclui ou atualiza dados.
          </p>
        </header>

        <div style={{ display: 'grid', gap: 16 }}>
          <CatalogFilters
            filters={draftFilters}
            viewMode={viewMode}
            loading={loading}
            onChange={setDraftFilters}
            onViewModeChange={setViewMode}
            onApply={() => setFilters({ ...draftFilters, page: 1 })}
            onClear={() => {
              setDraftFilters(initialFilters);
              setFilters(initialFilters);
            }}
          />

          {!hasStoreId && (
            <section style={{ padding: 18, border: '1px solid #bfdbfe', borderRadius: 10, backgroundColor: '#eff6ff', color: '#1e3a8a' }}>
              Informe uma loja para carregar as peças sem sobrecarregar o banco.
            </section>
          )}

          {error && (
            <section style={{ padding: 16, border: '1px solid #fecaca', borderRadius: 10, backgroundColor: '#fef2f2', color: '#b91c1c' }}>
              {error}
            </section>
          )}

          {hasStoreId && (
            <section style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <strong>Mostrando {result.total ?? result.items.length} peças</strong>
                {loading && <span style={{ color: '#64748b' }}>Carregando...</span>}
              </div>

              {!loading && result.items.length === 0 && (
                <div style={{ padding: 18, border: '1px solid #dbe2ea', borderRadius: 10, backgroundColor: '#fff', color: '#64748b' }}>
                  Nenhuma peça encontrada para os filtros atuais.
                </div>
              )}

              {viewMode === 'list' ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {result.items.map((part) => <CatalogPartListItem key={part.id} part={part} />)}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                  {result.items.map((part) => <CatalogPartGridCard key={part.id} part={part} />)}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, border: '1px solid #dbe2ea', borderRadius: 10, backgroundColor: '#fff' }}>
                <button type="button" disabled={loading || filters.page <= 1} onClick={() => changePage(Math.max(1, filters.page - 1))}>
                  Anterior
                </button>
                <span>Página {filters.page} de {totalPages}</span>
                <button type="button" disabled={loading || filters.page >= totalPages} onClick={() => changePage(Math.min(totalPages, filters.page + 1))}>
                  Próxima
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
