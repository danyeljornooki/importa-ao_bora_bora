import Link from 'next/link';
import React from 'react';
import type { CatalogPreviewPart } from '../types';
import { CatalogImagePreview } from './CatalogImagePreview';
import { money } from './CatalogInfoCard';

export function CatalogPartGridCard({ part }: { part: CatalogPreviewPart }) {
  return (
    <article style={{ border: '1px solid #dbe2ea', borderRadius: 10, backgroundColor: '#fff', overflow: 'hidden', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
      <CatalogImagePreview src={part.mainImageUrl} title={part.title} size="large" />
      <div style={{ padding: 14, display: 'grid', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 15, lineHeight: 1.3, textTransform: 'uppercase' }}>{part.title}</h2>
        <span style={{ width: 'fit-content', padding: '4px 8px', borderRadius: 999, backgroundColor: '#e0f2fe', color: '#075985', fontSize: 12, fontWeight: 800 }}>
          {part.displayCode}
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, color: '#475569', fontSize: 13 }}>
          <span><strong>Estoque:</strong> {part.stockQuantity ?? 0}</span>
          <span><strong>Preço:</strong> {money(part.price)}</span>
          <span><strong>Status:</strong> {part.status ?? '-'}</span>
          <span><strong>Local:</strong> {part.locationName ?? 'Sem localização'}</span>
        </div>
        <Link href={`/catalogo-preview/${part.id}`} style={{ marginTop: 4, textAlign: 'center', padding: '10px 12px', borderRadius: 8, backgroundColor: '#2563eb', color: '#fff', textDecoration: 'none', fontWeight: 800 }}>
          Ver detalhe
        </Link>
      </div>
    </article>
  );
}
