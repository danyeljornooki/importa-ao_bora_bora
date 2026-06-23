import React from 'react';
import type { CatalogPreviewFilters, CatalogViewMode } from '../types';

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  backgroundColor: '#fff',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  color: '#334155',
  fontSize: 12,
  fontWeight: 800,
};

export function CatalogFilters({
  filters,
  viewMode,
  loading,
  onChange,
  onViewModeChange,
  onApply,
  onClear,
}: {
  filters: CatalogPreviewFilters;
  viewMode: CatalogViewMode;
  loading: boolean;
  onChange: (filters: CatalogPreviewFilters) => void;
  onViewModeChange: (mode: CatalogViewMode) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const update = (patch: Partial<CatalogPreviewFilters>) =>
    onChange({ ...filters, ...patch, page: 1 });

  return (
    <section style={{ padding: 16, border: '1px solid #dbe2ea', borderRadius: 10, backgroundColor: '#fff' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <label>
          <span style={labelStyle}>store_id</span>
          <input value={filters.storeId ?? ''} onChange={(event) => update({ storeId: event.target.value })} style={inputStyle} placeholder="obrigatório" />
        </label>
        <label>
          <span style={labelStyle}>Texto livre</span>
          <input value={filters.search ?? ''} onChange={(event) => update({ search: event.target.value })} style={inputStyle} placeholder="nome, código ou MLB" />
        </label>
        <label>
          <span style={labelStyle}>Status</span>
          <input value={filters.status ?? ''} onChange={(event) => update({ status: event.target.value })} style={inputStyle} placeholder="ex: active" />
        </label>
        <label>
          <span style={labelStyle}>Estoque</span>
          <select value={filters.stock ?? 'all'} onChange={(event) => update({ stock: event.target.value as CatalogPreviewFilters['stock'] })} style={inputStyle}>
            <option value="all">Todos</option>
            <option value="in_stock">Com estoque</option>
            <option value="out_of_stock">Sem estoque</option>
          </select>
        </label>
        <label>
          <span style={labelStyle}>Localização</span>
          <select value={filters.location ?? 'all'} onChange={(event) => update({ location: event.target.value as CatalogPreviewFilters['location'] })} style={inputStyle}>
            <option value="all">Todos</option>
            <option value="with_location">Com localização</option>
            <option value="without_location">Sem localização</option>
          </select>
        </label>
        <label>
          <span style={labelStyle}>Imagem</span>
          <select value={filters.image ?? 'all'} onChange={(event) => update({ image: event.target.value as CatalogPreviewFilters['image'] })} style={inputStyle}>
            <option value="all">Todos</option>
            <option value="with_image">Com imagem</option>
            <option value="without_image">Sem imagem</option>
          </select>
        </label>
        <label>
          <span style={labelStyle}>Anúncio</span>
          <select value={filters.ad ?? 'all'} onChange={(event) => update({ ad: event.target.value as CatalogPreviewFilters['ad'] })} style={inputStyle}>
            <option value="all">Todos</option>
            <option value="with_mlb">Com MLB</option>
            <option value="without_mlb">Sem MLB</option>
          </select>
        </label>
        <label>
          <span style={labelStyle}>Ordenação</span>
          <select value={filters.sort ?? 'recent'} onChange={(event) => update({ sort: event.target.value as CatalogPreviewFilters['sort'] })} style={inputStyle}>
            <option value="recent">Mais recentes</option>
            <option value="updated">Atualizados recentemente</option>
            <option value="name_asc">Nome A-Z</option>
            <option value="price_asc">Menor preço</option>
            <option value="price_desc">Maior preço</option>
          </select>
        </label>
        <label>
          <span style={labelStyle}>Itens por página</span>
          <select value={filters.pageSize} onChange={(event) => onChange({ ...filters, pageSize: Number(event.target.value), page: 1 })} style={inputStyle}>
            {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => onViewModeChange('list')} style={{ padding: '9px 13px', borderRadius: 8, border: '1px solid #cbd5e1', backgroundColor: viewMode === 'list' ? '#2563eb' : '#fff', color: viewMode === 'list' ? '#fff' : '#334155', fontWeight: 800 }}>
            Lista
          </button>
          <button type="button" onClick={() => onViewModeChange('grid')} style={{ padding: '9px 13px', borderRadius: 8, border: '1px solid #cbd5e1', backgroundColor: viewMode === 'grid' ? '#2563eb' : '#fff', color: viewMode === 'grid' ? '#fff' : '#334155', fontWeight: 800 }}>
            Grid
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onClear} disabled={loading} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', backgroundColor: '#fff' }}>
            Limpar
          </button>
          <button type="button" onClick={onApply} disabled={loading} style={{ padding: '10px 16px', borderRadius: 8, border: 0, backgroundColor: '#16a34a', color: '#fff', fontWeight: 800 }}>
            {loading ? 'Carregando...' : 'Mostrar detalhes'}
          </button>
        </div>
      </div>
    </section>
  );
}
