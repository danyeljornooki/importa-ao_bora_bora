import React from 'react';

export const money = (value: number | null): string =>
  value === null
    ? '-'
    : new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);

export const dateLabel = (value: string | null): string =>
  value ? new Date(value).toLocaleDateString('pt-BR') : '-';

export function CatalogInfoCard({
  label,
  value,
  tone = '#0f172a',
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
}) {
  return (
    <div style={{ padding: 12, border: '1px solid #dbe2ea', borderRadius: 8, backgroundColor: '#f8fafc' }}>
      <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
      <div style={{ marginTop: 4, color: tone, fontSize: 16, fontWeight: 800 }}>{value}</div>
    </div>
  );
}
