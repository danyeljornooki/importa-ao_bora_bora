import Link from 'next/link';
import React from 'react';
import type { CatalogPreviewPart } from '../types';
import { CatalogImagePreview } from './CatalogImagePreview';
import { CatalogInfoCard, dateLabel, money } from './CatalogInfoCard';

export function CatalogPartListItem({ part }: { part: CatalogPreviewPart }) {
  return (
    <article style={{ display: 'grid', gridTemplateColumns: '112px minmax(0, 1fr) 240px', gap: 16, padding: 16, border: '1px solid #dbe2ea', borderRadius: 10, backgroundColor: '#fff', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
      <CatalogImagePreview src={part.mainImageUrl} title={part.title} />

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ padding: '4px 8px', borderRadius: 999, backgroundColor: '#dcfce7', color: '#166534', fontSize: 12, fontWeight: 800 }}>
            {part.status ?? 'sem status'}
          </span>
          <span style={{ padding: '4px 8px', borderRadius: 999, backgroundColor: '#e0f2fe', color: '#075985', fontSize: 12, fontWeight: 800 }}>
            {part.displayCode}
          </span>
          {part.primaryMlbId && (
            <span style={{ padding: '4px 8px', borderRadius: 999, backgroundColor: '#fef9c3', color: '#854d0e', fontSize: 12, fontWeight: 800 }}>
              {part.primaryMlbId}
            </span>
          )}
        </div>
        <h2 style={{ margin: '0 0 6px', textTransform: 'uppercase', fontSize: 18, color: '#0f172a' }}>{part.title}</h2>
        <p style={{ margin: '0 0 12px', color: '#64748b' }}>{part.categoryName ?? 'Sem item de catálogo vinculado'}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
          <CatalogInfoCard label="Qtd. estoque" value={part.stockQuantity ?? 0} />
          <CatalogInfoCard label="Qtd. geral" value={part.stockQuantity ?? 0} />
          <CatalogInfoCard label="Preço" value={money(part.price)} tone="#166534" />
          <CatalogInfoCard label="Preço MKP" value={money(part.marketplacePrice)} tone="#1d4ed8" />
          <CatalogInfoCard label="Criado" value={dateLabel(part.createdAt)} />
          <CatalogInfoCard label="Atualizado" value={dateLabel(part.updatedAt)} />
        </div>
      </div>

      <aside style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
        <Link href={`/catalogo-preview/${part.id}`} style={{ textAlign: 'center', padding: '10px 12px', borderRadius: 8, backgroundColor: '#2563eb', color: '#fff', textDecoration: 'none', fontWeight: 800 }}>
          Ver detalhe
        </Link>
        <button type="button" disabled style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #dbe2ea', backgroundColor: '#f8fafc', color: '#94a3b8' }}>
          Editar indisponível
        </button>
        <CatalogInfoCard label="Localização" value={part.locationName ?? 'Sem localização'} />
        <CatalogInfoCard label="Veículo" value={part.vehicleLabel ?? 'Sem veículo vinculado'} />
      </aside>
    </article>
  );
}
