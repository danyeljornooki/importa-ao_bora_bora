import Link from 'next/link';
import React, { useState } from 'react';
import { conditionLabelFromAd } from '../catalogPreviewMapper';
import type { CatalogPreviewPart } from '../types';
import { CatalogImagePreview, CatalogThumbnails } from './CatalogImagePreview';
import { CatalogInfoCard, dateLabel, money } from './CatalogInfoCard';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ padding: 16, border: '1px solid #dbe2ea', borderRadius: 10, backgroundColor: '#fff' }}>
    <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>{title}</h2>
    <div style={{ color: '#334155' }}>{children}</div>
  </section>
);

export function CatalogPartDetail({ part }: { part: CatalogPreviewPart }) {
  const [showTechnical, setShowTechnical] = useState(false);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Link href="/catalogo-preview" style={{ color: '#2563eb', fontWeight: 800 }}>Voltar para listagem</Link>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.8fr)', gap: 18 }}>
        <div style={{ padding: 16, border: '1px solid #dbe2ea', borderRadius: 10, backgroundColor: '#fff' }}>
          <CatalogImagePreview src={part.mainImageUrl} title={part.title} size="large" />
          <div style={{ marginTop: 12 }}>
            <CatalogThumbnails pictures={part.pictures} activeUrl={part.mainImageUrl} />
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <div style={{ padding: 16, border: '1px solid #dbe2ea', borderRadius: 10, backgroundColor: '#fff' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={{ padding: '5px 9px', borderRadius: 999, backgroundColor: '#dbeafe', color: '#1d4ed8', fontWeight: 900, fontSize: 12 }}>PEÇA PREVIEW</span>
              <span style={{ padding: '5px 9px', borderRadius: 999, backgroundColor: '#dcfce7', color: '#166534', fontWeight: 900, fontSize: 12 }}>{part.displayCode}</span>
              <span style={{ padding: '5px 9px', borderRadius: 999, backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 900, fontSize: 12 }}>Estoque {part.stockQuantity ?? 0}</span>
            </div>
            <h1 style={{ margin: '0 0 10px', textTransform: 'uppercase' }}>{part.title}</h1>
            <p style={{ margin: 0, color: '#475569' }}>{part.description ?? 'Descrição pendente'}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
              <CatalogInfoCard label="Quantidade" value={part.stockQuantity ?? 0} />
              <CatalogInfoCard label="Preço" value={money(part.price)} tone="#166534" />
              <CatalogInfoCard label="Preço MKP" value={money(part.marketplacePrice)} tone="#1d4ed8" />
            </div>
          </div>

          <aside style={{ padding: 16, border: '1px solid #dbe2ea', borderRadius: 10, backgroundColor: '#f8fafc' }}>
            <h2 style={{ marginTop: 0 }}>Canais ativos</h2>
            <p>{part.primaryMlbId ? `Mercado Livre: ${part.primaryMlbId}` : 'Nenhum canal configurado'}</p>
            <CatalogInfoCard label="Última alteração" value={dateLabel(part.updatedAt)} />
            <button type="button" disabled style={{ marginTop: 10, width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', color: '#94a3b8' }}>
              Carregar histórico
            </button>
          </aside>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <Section title="Referência catálogo">{part.categoryName ?? 'Nenhuma peça de catálogo selecionada.'}</Section>
        <Section title="Nome para o Marketplace">{part.title}</Section>
        <Section title="Veículo de origem">{part.vehicleLabel ?? 'Sem veículo associado'}</Section>
        <Section title="Código da peça">{part.displayCode}</Section>
        <Section title="Estoque">{part.stockQuantity ?? 0}</Section>
        <Section title="Localização">{part.locationName ?? 'Sem localização definida'}</Section>
        <Section title="Marcadores">Sem marcadores definidos</Section>
        <Section title="Condição do item">{conditionLabelFromAd(part.selectedAd) || 'A - Excelente'}</Section>
        <Section title="Pesos e medidas">4 medidas pendentes</Section>
        <Section title="Preço">
          <div>Balcão: <strong>{money(part.price)}</strong></div>
          <div>Marketplace: <strong>{money(part.marketplacePrice)}</strong></div>
        </Section>
        <Section title="Imagens">{part.pictures.length} imagens vinculadas ao anúncio selecionado.</Section>
        <Section title="Canais e compatibilidades">{part.primaryMlbId ? 'Mercado Livre' : 'Nenhum canal configurado'}</Section>
      </div>

      <section style={{ padding: 16, border: '1px solid #dbe2ea', borderRadius: 10, backgroundColor: '#fff' }}>
        <button type="button" onClick={() => setShowTechnical((value) => !value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', backgroundColor: '#fff', fontWeight: 800 }}>
          {showTechnical ? 'Ocultar JSON técnico' : 'Mostrar JSON técnico'}
        </button>
        {showTechnical && (
          <pre style={{ maxHeight: 520, overflow: 'auto', marginTop: 12, padding: 12, backgroundColor: '#f8fafc' }}>
{JSON.stringify({
  inventory: part.rawInventory,
  ad: part.selectedAd,
}, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
