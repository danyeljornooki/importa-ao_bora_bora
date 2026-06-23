import React from 'react';
import type { CatalogPicture } from '../types';

const placeholder = 'linear-gradient(135deg, #dbeafe, #ecfeff)';

export function CatalogImagePreview({
  src,
  title,
  size = 'thumb',
}: {
  src: string | null;
  title: string;
  size?: 'thumb' | 'large';
}) {
  const width = size === 'large' ? '100%' : 112;
  const height = size === 'large' ? 420 : 112;

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid #dbe2ea',
        background: placeholder,
        display: 'grid',
        placeItems: 'center',
        color: '#64748b',
        fontWeight: 700,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <span style={{ fontSize: size === 'large' ? 18 : 12 }}>Sem imagem</span>
      )}
    </div>
  );
}

export function CatalogThumbnails({
  pictures,
  activeUrl,
}: {
  pictures: CatalogPicture[];
  activeUrl: string | null;
}) {
  const visible = pictures.slice(0, 3);
  const remaining = Math.max(0, pictures.length - visible.length);

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {visible.map((picture, index) => {
        const url = picture.secure_url ?? picture.url ?? null;
        return (
          <div key={`${url ?? 'picture'}-${index}`} style={{ position: 'relative' }}>
            <CatalogImagePreview src={url} title={`Imagem ${index + 1}`} />
            {url === activeUrl && (
              <span style={{ position: 'absolute', left: 6, top: 6, padding: '2px 6px', borderRadius: 999, backgroundColor: '#2563eb', color: '#fff', fontSize: 10, fontWeight: 800 }}>
                principal
              </span>
            )}
          </div>
        );
      })}
      {remaining > 0 && (
        <div style={{ width: 112, height: 112, borderRadius: 8, border: '1px dashed #93c5fd', display: 'grid', placeItems: 'center', backgroundColor: '#eff6ff', color: '#1d4ed8', fontWeight: 800 }}>
          +{remaining}
        </div>
      )}
    </div>
  );
}
