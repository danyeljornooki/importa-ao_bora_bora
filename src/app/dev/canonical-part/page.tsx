'use client';

import React, { useState } from 'react';
import { fromExistingInventoryItem } from '../../../domain/part/mappers/fromExistingInventoryItem';
import { fromPartCanonical } from '../../../domain/part/mappers/fromPartCanonical';
import { toMongoInventoryShape } from '../../../domain/part/mappers/toMongoInventoryShape';
import type { CanonicalPart } from '../../../domain/part/part.types';
import type { PartCanonical } from '../../../modules/importer/schemas/part.schema';
import type { ExistingInventoryItem } from '../../../types/inventory.types';

interface ConversionResult {
  canonicalPart: CanonicalPart;
  mongoInventoryShape: Record<string, unknown>;
}

const partCanonicalExample = JSON.stringify(
  {
    id_int: 123,
    code: 'PEC-123',
    title: 'Peça de exemplo',
    price: 199.9,
    marketplace_price: 219.9,
    stock_quantity: 2,
    location: 'Prateleira A1',
    description: 'Descrição técnica da peça.',
    mlb_ids: ['MLB123456789'],
    image_urls: ['https://example.com/peca.jpg'],
  },
  null,
  2
);

const existingInventoryExample = JSON.stringify(
  {
    id: 'inventory-item-id',
    store_id: 'store-id',
    id_int: 123,
    id_string: 'MLB123456789',
    code: 'PEC-123',
    marketplace_name: 'Peça de exemplo',
    description: 'Descrição técnica da peça.',
    stock_quantity: 2,
    price: 199.9,
    marketplace_price: 219.9,
    status: 'DISPONIVEL',
    storage_location_id: 'location-id',
    storage_location_name: 'Prateleira A1',
    images: ['https://example.com/peca.jpg'],
    catalog_attributes: [],
    mercado_libre_brasil_category_id: 'MLB-CATEGORY',
    part_category_id: 'category-id',
    part_category_name: 'Categoria de exemplo',
    vehicle_brand_name: 'Marca',
  },
  null,
  2
);

const sectionStyle: React.CSSProperties = {
  padding: 20,
  border: '1px solid #dbe2ea',
  borderRadius: 10,
  backgroundColor: '#fff',
  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 280,
  boxSizing: 'border-box',
  padding: 12,
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontFamily: 'Consolas, monospace',
  fontSize: 13,
  lineHeight: 1.5,
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 16px',
  border: 0,
  borderRadius: 6,
  backgroundColor: '#2563eb',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};

const parseObject = (value: string, label: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} deve ser um objeto JSON.`);
  }

  return parsed as Record<string, unknown>;
};

const JsonPreview = ({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) => (
  <div>
    <h3 style={{ marginBottom: 8 }}>{title}</h3>
    <pre
      style={{
        maxHeight: 520,
        overflow: 'auto',
        margin: 0,
        padding: 14,
        borderRadius: 6,
        backgroundColor: '#0f172a',
        color: '#e2e8f0',
        fontSize: 12,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  </div>
);

const DebugSummary = ({ part }: { part: CanonicalPart }) => {
  const mongo = toMongoInventoryShape(part);

  const fields: Array<[string, unknown]> = [
    ['title', part.identity.title],
    ['id_int', part.identity.idInt ?? null],
    ['code', part.identity.code ?? null],
    ['stock_quantity', part.commercial.stockQuantity],
    ['price', part.commercial.price],
    [
      'marketplace_price',
      part.commercial.marketplacePrice ?? part.commercial.price,
    ],
    ['category', part.category ?? null],
    ['brand', part.vehicle?.brandName ?? null],
    ['location', part.organization.locationName ?? null],
    ['description', part.content.description ?? null],
    ['images count', part.images.length],
    ['marketplace links', part.marketplace],
    ['mongo status', mongo.status],
  ];

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>Debug de compatibilidade</h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 8,
        }}
      >
        {fields.map(([label, value]) => (
          <div
            key={label}
            style={{
              padding: 10,
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              backgroundColor: '#f8fafc',
            }}
          >
            <div style={{ color: '#64748b', fontSize: 12 }}>{label}</div>
            <div
              style={{
                marginTop: 4,
                color: '#0f172a',
                fontFamily:
                  typeof value === 'object' ? 'Consolas, monospace' : 'inherit',
                fontSize: 13,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {typeof value === 'object'
                ? JSON.stringify(value, null, 2)
                : String(value ?? '-')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ConversionOutput = ({
  result,
}: {
  result: ConversionResult | null;
}) => {
  if (!result) return null;

  return (
    <div style={{ display: 'grid', gap: 18, marginTop: 18 }}>
      <DebugSummary part={result.canonicalPart} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        <JsonPreview title="CanonicalPart" value={result.canonicalPart} />
        <JsonPreview
          title="MongoInventoryShape"
          value={result.mongoInventoryShape}
        />
      </div>
    </div>
  );
};

export default function CanonicalPartCompatibilityPage() {
  const [storeId, setStoreId] = useState('store-id');
  const [partCanonicalJson, setPartCanonicalJson] =
    useState(partCanonicalExample);
  const [existingInventoryJson, setExistingInventoryJson] =
    useState(existingInventoryExample);
  const [partResult, setPartResult] = useState<ConversionResult | null>(null);
  const [existingResult, setExistingResult] =
    useState<ConversionResult | null>(null);
  const [partError, setPartError] = useState<string | null>(null);
  const [existingError, setExistingError] = useState<string | null>(null);

  const convertPartCanonical = () => {
    setPartError(null);

    try {
      const normalizedStoreId = storeId.trim();
      if (!normalizedStoreId) {
        throw new Error('storeId é obrigatório.');
      }

      const part = parseObject(
        partCanonicalJson,
        'PartCanonical'
      ) as unknown as PartCanonical;
      const canonicalPart = fromPartCanonical({
        part,
        storeId: normalizedStoreId,
      });

      setPartResult({
        canonicalPart,
        mongoInventoryShape: toMongoInventoryShape(canonicalPart),
      });
    } catch (error) {
      setPartResult(null);
      setPartError(error instanceof Error ? error.message : String(error));
    }
  };

  const convertExistingInventory = () => {
    setExistingError(null);

    try {
      const item = parseObject(
        existingInventoryJson,
        'ExistingInventoryItem'
      ) as unknown as ExistingInventoryItem;
      const canonicalPart = fromExistingInventoryItem(item);

      setExistingResult({
        canonicalPart,
        mongoInventoryShape: toMongoInventoryShape(canonicalPart),
      });
    } catch (error) {
      setExistingResult(null);
      setExistingError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '32px 20px 56px',
        backgroundColor: '#f1f5f9',
        color: '#0f172a',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div style={{ width: '100%', maxWidth: 1280, margin: '0 auto' }}>
        <header style={{ marginBottom: 24 }}>
          <div style={{ color: '#b45309', fontSize: 13, fontWeight: 700 }}>
            Ferramenta técnica de compatibilidade
          </div>
          <h1 style={{ margin: '6px 0 8px' }}>CanonicalPart Preview</h1>
          <p style={{ margin: 0, color: '#475569' }}>
            Converte exemplos em memória. Não consulta banco, não persiste dados
            e não altera a Import Engine.
          </p>
        </header>

        <div style={{ display: 'grid', gap: 20 }}>
          <section style={sectionStyle}>
            <h2 style={{ marginTop: 0 }}>PartCanonical</h2>
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span
                style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}
              >
                storeId
              </span>
              <input
                value={storeId}
                onChange={(event) => setStoreId(event.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: 10,
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                }}
              />
            </label>

            <textarea
              aria-label="JSON de PartCanonical"
              value={partCanonicalJson}
              onChange={(event) => setPartCanonicalJson(event.target.value)}
              spellCheck={false}
              style={textareaStyle}
            />
            <button
              type="button"
              onClick={convertPartCanonical}
              style={{ ...buttonStyle, marginTop: 12 }}
            >
              Converter PartCanonical
            </button>

            {partError && (
              <div style={{ marginTop: 12, color: '#b91c1c' }}>
                {partError}
              </div>
            )}

            <ConversionOutput result={partResult} />
          </section>

          <section style={sectionStyle}>
            <h2 style={{ marginTop: 0 }}>ExistingInventoryItem</h2>
            <textarea
              aria-label="JSON de ExistingInventoryItem"
              value={existingInventoryJson}
              onChange={(event) => setExistingInventoryJson(event.target.value)}
              spellCheck={false}
              style={textareaStyle}
            />
            <button
              type="button"
              onClick={convertExistingInventory}
              style={{ ...buttonStyle, marginTop: 12 }}
            >
              Converter ExistingInventoryItem
            </button>

            {existingError && (
              <div style={{ marginTop: 12, color: '#b91c1c' }}>
                {existingError}
              </div>
            )}

            <ConversionOutput result={existingResult} />
          </section>
        </div>
      </div>
    </main>
  );
}
