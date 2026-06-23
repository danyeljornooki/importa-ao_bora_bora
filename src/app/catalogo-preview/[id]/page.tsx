'use client';

import { useParams } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import { AppNavigation } from '../../../components/AppNavigation';
import { catalogPreviewAdapter } from '../../../features/catalog-preview/catalogPreviewAdapter';
import { CatalogPartDetail } from '../../../features/catalog-preview/components/CatalogPartDetail';
import type { CatalogPreviewPart } from '../../../features/catalog-preview/types';

export default function CatalogPreviewDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [part, setPart] = useState<CatalogPreviewPart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPart = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPart(await catalogPreviewAdapter.getCatalogPreviewPartById(id));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadPart();
  }, [loadPart]);

  return (
    <main style={{ minHeight: '100vh', padding: '32px 20px 56px', backgroundColor: '#eef4f8', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
      <div style={{ width: '100%', maxWidth: 1380, margin: '0 auto' }}>
        <AppNavigation />
        {loading && <div style={{ padding: 18, borderRadius: 10, backgroundColor: '#fff' }}>Carregando peça...</div>}
        {error && <div style={{ padding: 18, border: '1px solid #fecaca', borderRadius: 10, backgroundColor: '#fef2f2', color: '#b91c1c' }}>{error}</div>}
        {!loading && !error && !part && (
          <div style={{ padding: 18, borderRadius: 10, backgroundColor: '#fff', color: '#64748b' }}>Peça não encontrada.</div>
        )}
        {!loading && !error && part && <CatalogPartDetail part={part} />}
      </div>
    </main>
  );
}
