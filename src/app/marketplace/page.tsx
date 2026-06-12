'use client'

import Link from 'next/link';
import React, { useMemo, useRef, useState } from 'react';
import { AppNavigation } from '../../components/AppNavigation';
import {
  authenticateMercadoLivreIntegration,
  MercadoLivreAuthenticationError,
  type MercadoLivreAuthenticationAttempt,
} from '../../adapters/mercado-livre/mercadoLivreAuthAdapter';
import { mercadoLivreAdapter } from '../../adapters/mercado-livre/mercadoLivreAdapter';
import type { ImportExecutionContext } from '../../types/integration.types';
import type { MarketplaceListing } from '../../types/marketplace.types';

const LOAD_ALL_DELAY_MS = 300;
const MAX_LISTINGS = 50_000;

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
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 16px',
  border: 0,
  borderRadius: 6,
  backgroundColor: '#2563eb',
  color: '#fff',
  fontWeight: 700,
};

const nicknameFrom = (context: ImportExecutionContext | null): string | null => {
  const nickname = context?.marketplace?.user?.nickname;
  return typeof nickname === 'string' && nickname.trim() !== ''
    ? nickname.trim()
    : null;
};

const money = (value: number | null): string =>
  value === null
    ? '-'
    : new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(value);

const statusCount = (listings: MarketplaceListing[], statuses: string[]): number =>
  listings.filter((listing) =>
    listing.status ? statuses.includes(listing.status.toLowerCase()) : false
  ).length;

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const mergeListings = (
  current: MarketplaceListing[],
  incoming: MarketplaceListing[]
): MarketplaceListing[] =>
  Array.from(
    new Map(
      [...current, ...incoming].map((listing) => [listing.id, listing])
    ).values()
  );

const Metric = ({ label, value }: { label: string; value: number }) => (
  <div style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 8, backgroundColor: '#fff' }}>
    <div style={{ color: '#64748b', fontSize: 12, textTransform: 'uppercase' }}>{label}</div>
    <div style={{ marginTop: 4, fontSize: 24, fontWeight: 700 }}>{value}</div>
  </div>
);

export default function MarketplacePage() {
  const [integrationId, setIntegrationId] = useState<string>('');
  const [context, setContext] = useState<ImportExecutionContext | null>(null);
  const [integrationError, setIntegrationError] = useState<string | null>(null);
  const [integrationErrorDetails, setIntegrationErrorDetails] = useState<
    MercadoLivreAuthenticationAttempt[]
  >([]);
  const [isLoadingIntegration, setIsLoadingIntegration] = useState<boolean>(false);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [returnedIds, setReturnedIds] = useState<string[]>([]);
  const [scrollId, setScrollId] = useState<string | null>(null);
  const [isLoadingListings, setIsLoadingListings] = useState<boolean>(false);
  const [isLoadingAll, setIsLoadingAll] = useState<boolean>(false);
  const [cancelLoadAll, setCancelLoadAll] = useState<boolean>(false);
  const [loadedBatches, setLoadedBatches] = useState<number>(0);
  const [totalLoaded, setTotalLoaded] = useState<number>(0);
  const [lastBatchSize, setLastBatchSize] = useState<number>(0);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showJson, setShowJson] = useState<boolean>(false);
  const cancelLoadAllRef = useRef<boolean>(false);

  const clearListings = () => {
    cancelLoadAllRef.current = true;
    setListings([]);
    setReturnedIds([]);
    setScrollId(null);
    setListingsError(null);
    setIsLoadingAll(false);
    setCancelLoadAll(false);
    setLoadedBatches(0);
    setTotalLoaded(0);
    setLastBatchSize(0);
  };

  const loadIntegration = async () => {
    setIsLoadingIntegration(true);
    setIntegrationError(null);
    setIntegrationErrorDetails([]);
    setContext(null);
    clearListings();

    try {
      setContext(await authenticateMercadoLivreIntegration(integrationId));
    } catch (error: unknown) {
      setIntegrationError(error instanceof Error ? error.message : String(error));
      setIntegrationErrorDetails(
        error instanceof MercadoLivreAuthenticationError ? error.attempts : []
      );
    } finally {
      setIsLoadingIntegration(false);
    }
  };

  const loadListings = async (append: boolean) => {
    if (!context) return;

    setIsLoadingListings(true);
    setListingsError(null);

    try {
      const result = await mercadoLivreAdapter.scanListings(context, {
        status: 'active',
        scrollId: append ? scrollId : null,
      });

      setListings((current) => {
        const combined = append
          ? mergeListings(current, result.listings)
          : mergeListings([], result.listings);
        setTotalLoaded(combined.length);
        return combined;
      });
      setReturnedIds((current) => append
        ? Array.from(new Set([...current, ...result.ids]))
        : result.ids
      );
      setScrollId(result.scrollId);
      setLoadedBatches((current) => append ? current + 1 : 1);
      setLastBatchSize(result.listings.length);
    } catch (error: unknown) {
      setListingsError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingListings(false);
    }
  };

  const loadAllListings = async () => {
    if (!context || isLoadingListings || isLoadingAll) return;

    cancelLoadAllRef.current = false;
    setCancelLoadAll(false);
    setIsLoadingAll(true);
    setListingsError(null);
    setListings([]);
    setReturnedIds([]);
    setScrollId(null);
    setLoadedBatches(0);
    setTotalLoaded(0);
    setLastBatchSize(0);

    const listingsById = new Map<string, MarketplaceListing>();
    const ids = new Set<string>();
    const seenScrollIds = new Set<string>();
    let nextScrollId: string | null = null;
    let batchCount = 0;

    try {
      while (!cancelLoadAllRef.current && listingsById.size < MAX_LISTINGS) {
        const result = await mercadoLivreAdapter.scanListings(context, {
          status: statusFilter || 'active',
          scrollId: nextScrollId,
        });

        batchCount += 1;
        for (const id of result.ids) ids.add(id);
        for (const listing of result.listings) {
          listingsById.set(listing.id, listing);
          if (listingsById.size >= MAX_LISTINGS) break;
        }

        const loadedListings = Array.from(listingsById.values());
        setListings(loadedListings);
        setReturnedIds(Array.from(ids));
        setScrollId(result.scrollId);
        setLoadedBatches(batchCount);
        setTotalLoaded(loadedListings.length);
        setLastBatchSize(result.listings.length);

        if (result.ids.length === 0 || !result.scrollId) break;
        if (seenScrollIds.has(result.scrollId)) {
          throw new Error('O Mercado Livre retornou um scroll_id repetido.');
        }

        seenScrollIds.add(result.scrollId);
        nextScrollId = result.scrollId;

        if (!cancelLoadAllRef.current) {
          await delay(LOAD_ALL_DELAY_MS);
        }
      }
    } catch (error: unknown) {
      setListingsError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingAll(false);
      setCancelLoadAll(cancelLoadAllRef.current);
    }
  };

  const cancelLoadingAll = () => {
    cancelLoadAllRef.current = true;
    setCancelLoadAll(true);
  };

  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase();
    const status = statusFilter.trim().toLowerCase();

    return listings.filter((listing) => {
      const matchesStatus =
        !status || listing.status?.toLowerCase() === status;
      const matchesSearch =
        !query ||
        listing.id.toLowerCase().includes(query) ||
        listing.title?.toLowerCase().includes(query) ||
        listing.sellerSku?.toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [listings, search, statusFilter]);

  return (
    <main style={{ minHeight: '100vh', padding: '32px 20px 56px', backgroundColor: '#f1f5f9', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 1400, margin: '0 auto' }}>
        <AppNavigation />
        <header style={{ marginBottom: 24 }}>
          <div style={{ color: '#2563eb', fontSize: 13, fontWeight: 700 }}>Marketplace / Mercado Livre</div>
          <h1 style={{ margin: '6px 0 8px' }}>Marketplace Explorer</h1>
          <p style={{ margin: 0, color: '#475569' }}>Consulta somente leitura de anúncios pelo fluxo scan/scroll_id.</p>
          <div style={{ marginTop: 10 }}>
            <Link href="/importacoes/pecas">Voltar para Importação de Peças</Link>
          </div>
        </header>

        <div style={{ display: 'grid', gap: 18 }}>
          <section style={sectionStyle}>
            <h2 style={{ marginTop: 0 }}>Integração</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) auto', gap: 12, alignItems: 'end' }}>
              <label>
                <span style={{ display: 'block', marginBottom: 8, fontWeight: 700 }}>Integration ID</span>
                <input
                  value={integrationId}
                  disabled={isLoadingIntegration || isLoadingListings || isLoadingAll}
                  onChange={(event) => {
                    setIntegrationId(event.target.value);
                    setContext(null);
                    setIntegrationError(null);
                    setIntegrationErrorDetails([]);
                    clearListings();
                  }}
                  style={inputStyle}
                />
              </label>
              <button
                type="button"
                onClick={loadIntegration}
                disabled={integrationId.trim() === '' || isLoadingIntegration || isLoadingListings || isLoadingAll}
                style={{ ...buttonStyle, opacity: integrationId.trim() === '' || isLoadingIntegration ? 0.55 : 1 }}
              >
                {isLoadingIntegration ? 'Carregando...' : 'Carregar Integração'}
              </button>
            </div>

            {integrationError && <div style={{ marginTop: 12, color: '#b91c1c' }}>{integrationError}</div>}
            {integrationErrorDetails.length > 0 && (
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Erro técnico da autenticação</summary>
                <pre style={{ overflow: 'auto', padding: 12, backgroundColor: '#fef2f2' }}>
{JSON.stringify(integrationErrorDetails, null, 2)}
                </pre>
              </details>
            )}

            {context && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginTop: 16, padding: 14, borderRadius: 8, backgroundColor: '#eff6ff' }}>
                <div><strong>Store ID:</strong> {context.storeId}</div>
                <div><strong>Nome:</strong> {context.integrationName ?? '-'}</div>
                <div><strong>Canal:</strong> {context.channel}</div>
                <div><strong>User ID:</strong> {context.marketplace?.userId ?? '-'}</div>
                <div><strong>Nickname:</strong> {nicknameFrom(context) ?? '-'}</div>
                <div><strong>Token:</strong> {context.marketplace?.accessToken ? 'presente' : 'ausente'}</div>
                <div><strong>Token expira em:</strong> {context.marketplace?.tokenExpiresIn ?? '-'}</div>
              </div>
            )}
          </section>

          <section style={sectionStyle}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void loadListings(false)}
                disabled={!context || isLoadingListings || isLoadingAll}
                style={{ ...buttonStyle, backgroundColor: '#15803d', opacity: !context || isLoadingListings || isLoadingAll ? 0.55 : 1 }}
              >
                {isLoadingListings ? 'Carregando...' : 'Carregar anúncios ativos'}
              </button>
              <button
                type="button"
                onClick={() => void loadListings(true)}
                disabled={!context || !scrollId || isLoadingListings || isLoadingAll}
                style={{ ...buttonStyle, backgroundColor: '#475569', opacity: !context || !scrollId || isLoadingListings || isLoadingAll ? 0.55 : 1 }}
              >
                Carregar mais
              </button>
              <button
                type="button"
                onClick={() => void loadAllListings()}
                disabled={!context || isLoadingListings || isLoadingAll}
                style={{ ...buttonStyle, backgroundColor: '#7c3aed', opacity: !context || isLoadingListings || isLoadingAll ? 0.55 : 1 }}
              >
                {isLoadingAll ? 'Carregando todos...' : 'Carregar todos'}
              </button>
              {isLoadingAll && (
                <button
                  type="button"
                  onClick={cancelLoadingAll}
                  disabled={cancelLoadAll}
                  style={{ ...buttonStyle, backgroundColor: '#b91c1c', opacity: cancelLoadAll ? 0.55 : 1 }}
                >
                  {cancelLoadAll ? 'Cancelando...' : 'Cancelar carregamento'}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 14, color: '#475569' }}>
              <span><strong>Lotes carregados:</strong> {loadedBatches}</span>
              <span><strong>Anúncios carregados:</strong> {totalLoaded}</span>
              <span><strong>Último lote:</strong> {lastBatchSize}</span>
            </div>
            {listingsError && <div style={{ marginTop: 12, color: '#b91c1c' }}>{listingsError}</div>}
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <Metric label="Total carregado" value={listings.length} />
            <Metric label="Ativos" value={statusCount(listings, ['active'])} />
            <Metric label="Pausados" value={statusCount(listings, ['paused'])} />
            <Metric label="Fechados" value={statusCount(listings, ['closed'])} />
            <Metric label="Em revisão" value={statusCount(listings, ['under_review', 'pending'])} />
          </section>

          <section style={sectionStyle}>
            <h2 style={{ marginTop: 0 }}>Anúncios</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) minmax(160px, 1fr)', gap: 12, marginBottom: 16 }}>
              <label>
                <span style={{ display: 'block', marginBottom: 6 }}>Buscar título, MLB ou SKU</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} style={inputStyle} />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: 6 }}>Status</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={inputStyle}>
                  <option value="">Todos</option>
                  <option value="active">Ativo</option>
                  <option value="paused">Pausado</option>
                  <option value="closed">Fechado</option>
                  <option value="under_review">Em revisão</option>
                  <option value="pending">Pendente</option>
                </select>
              </label>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1050 }}>
                <thead>
                  <tr style={{ textAlign: 'left', backgroundColor: '#f8fafc' }}>
                    {['MLB', 'Título', 'Preço', 'Quantidade', 'Status', 'Categoria', 'SKU'].map((heading) => (
                      <th key={heading} style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredListings.map((listing) => (
                    <tr key={listing.id}>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>
                        {listing.permalink ? (
                          <a href={listing.permalink} target="_blank" rel="noreferrer">{listing.id}</a>
                        ) : listing.id}
                      </td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{listing.title ?? '-'}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{money(listing.price)}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{listing.availableQuantity ?? '-'}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{listing.status ?? '-'}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{listing.categoryId ?? '-'}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{listing.sellerSku ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredListings.length === 0 && (
                <div style={{ padding: 18, color: '#64748b' }}>Nenhum anúncio carregado para os filtros atuais.</div>
              )}
            </div>
          </section>

          <section style={sectionStyle}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              <input type="checkbox" checked={showJson} onChange={(event) => setShowJson(event.target.checked)} />
              Mostrar JSON
            </label>
            {showJson && (
              <pre style={{ overflow: 'auto', maxHeight: 500, marginTop: 12, padding: 12, backgroundColor: '#f8fafc' }}>
{JSON.stringify({
  ids: returnedIds,
  scrollId,
  listings: listings.slice(0, 20),
}, null, 2)}
              </pre>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
