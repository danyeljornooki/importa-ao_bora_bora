'use client';

import React, { useState } from 'react';
import { AppNavigation } from '../../components/AppNavigation';
import { parseImportFile } from '../../modules/importer/parseImportFile';
import {
  crossColumnLookup,
  findDuplicateRows,
  type ValueTransform,
  type CrossColumnResult,
  type DuplicatesResult,
} from '../../modules/importer/diagnostics';

const sectionStyle: React.CSSProperties = {
  padding: 20,
  border: '1px solid #dbe2ea',
  borderRadius: 10,
  backgroundColor: '#fff',
  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 8,
  color: '#334155',
  fontSize: 14,
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: 14,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '11px 18px',
  border: 0,
  borderRadius: 6,
  backgroundColor: '#1d4ed8',
  color: '#fff',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};

const TRANSFORMS: { value: ValueTransform; label: string }[] = [
  { value: 'none', label: 'Nenhum (trim + minúsculas)' },
  { value: 'digits', label: 'Apenas dígitos (1234C → 1234)' },
  { value: 'letters', label: 'Apenas letras' },
  { value: 'alphanumeric', label: 'Alfanumérico (sem símbolos)' },
  { value: 'text', label: 'Texto (sem acento)' },
];

interface LoadedSheet {
  name: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

const loadSheet = async (file: File): Promise<LoadedSheet> => {
  const parsed = await parseImportFile(file, { fileName: file.name });
  const headerSet = new Set<string>();
  parsed.rows.forEach((row) =>
    Object.keys(row as Record<string, unknown>).forEach((k) => headerSet.add(k))
  );
  return {
    name: file.name,
    headers: Array.from(headerSet),
    rows: parsed.rows as Record<string, unknown>[],
  };
};

const ColumnSelect = ({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) => (
  <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
    <option value="">— escolher coluna —</option>
    {options.map((h) => (
      <option key={h} value={h}>{h}</option>
    ))}
  </select>
);

const TransformSelect = ({
  value,
  onChange,
}: {
  value: ValueTransform;
  onChange: (v: ValueTransform) => void;
}) => (
  <select value={value} onChange={(e) => onChange(e.target.value as ValueTransform)} style={inputStyle}>
    {TRANSFORMS.map((t) => (
      <option key={t.value} value={t.value}>{t.label}</option>
    ))}
  </select>
);

export default function DiagnosticoPage() {
  const [sheetA, setSheetA] = useState<LoadedSheet | null>(null);
  const [sheetB, setSheetB] = useState<LoadedSheet | null>(null);

  // Duplicatas (usa a planilha A)
  const [dupColumn, setDupColumn] = useState('');
  const [dupTransform, setDupTransform] = useState<ValueTransform>('none');
  const [dupResult, setDupResult] = useState<DuplicatesResult | null>(null);

  // Cruzamento (A x B)
  const [crossColA, setCrossColA] = useState('');
  const [crossColB, setCrossColB] = useState('');
  const [crossTransform, setCrossTransform] = useState<ValueTransform>('none');
  const [crossResult, setCrossResult] = useState<CrossColumnResult | null>(null);

  const [error, setError] = useState<string | null>(null);

  const onSelectA = async (file: File | null) => {
    setError(null);
    setDupResult(null);
    setCrossResult(null);
    if (!file) return setSheetA(null);
    try {
      setSheetA(await loadSheet(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onSelectB = async (file: File | null) => {
    setError(null);
    setCrossResult(null);
    if (!file) return setSheetB(null);
    try {
      setSheetB(await loadSheet(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const runDuplicates = () => {
    if (!sheetA || !dupColumn) return;
    setDupResult(findDuplicateRows(sheetA.rows, dupColumn, dupTransform));
  };

  const runCross = () => {
    if (!sheetA || !sheetB || !crossColA || !crossColB) return;
    setCrossResult(crossColumnLookup(sheetA.rows, crossColA, sheetB.rows, crossColB, crossTransform));
  };

  return (
    <main style={{ minHeight: '100vh', padding: '32px 20px 56px', backgroundColor: '#f1f5f9', color: '#0f172a', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 1080, margin: '0 auto' }}>
        <AppNavigation />
        <header style={{ marginBottom: 24 }}>
          <div style={{ color: '#2563eb', fontSize: 13, fontWeight: 700 }}>Ferramentas</div>
          <h1 style={{ margin: '6px 0 8px', fontSize: 32 }}>Diagnóstico de Planilha</h1>
          <p style={{ margin: 0, color: '#475569' }}>
            Investigue os dados crus de um cliente antes de importar: ache duplicatas e valores
            que aparecem na coluna errada. Nada é gravado.
          </p>
        </header>

        <div style={{ display: 'grid', gap: 18 }}>
          <section style={sectionStyle}>
            <h2 style={{ marginTop: 0 }}>Planilhas</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div>
                <span style={labelStyle}>Planilha A</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => void onSelectA(e.target.files?.[0] ?? null)} />
                <div style={{ marginTop: 8, color: sheetA ? '#0f172a' : '#64748b', fontSize: 13 }}>
                  {sheetA ? `${sheetA.name} — ${sheetA.rows.length} linhas, ${sheetA.headers.length} colunas` : 'nenhum arquivo'}
                </div>
              </div>
              <div>
                <span style={labelStyle}>Planilha B (para cruzamento)</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => void onSelectB(e.target.files?.[0] ?? null)} />
                <div style={{ marginTop: 8, color: sheetB ? '#0f172a' : '#64748b', fontSize: 13 }}>
                  {sheetB ? `${sheetB.name} — ${sheetB.rows.length} linhas, ${sheetB.headers.length} colunas` : 'nenhum arquivo'}
                </div>
              </div>
            </div>
            {error && <div style={{ marginTop: 12, color: '#b91c1c' }}>{error}</div>}
          </section>

          {sheetA && (
            <section style={sectionStyle}>
              <h2 style={{ marginTop: 0 }}>🔁 Detector de Duplicatas (Planilha A)</h2>
              <p style={{ margin: '0 0 14px', color: '#475569', fontSize: 14 }}>
                Encontra valores que aparecem mais de uma vez numa coluna.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) auto', gap: 10, alignItems: 'end' }}>
                <label><span style={labelStyle}>Coluna</span><ColumnSelect value={dupColumn} options={sheetA.headers} onChange={setDupColumn} /></label>
                <label><span style={labelStyle}>Tratamento</span><TransformSelect value={dupTransform} onChange={setDupTransform} /></label>
                <button type="button" onClick={runDuplicates} disabled={!dupColumn} style={{ ...primaryButtonStyle, opacity: dupColumn ? 1 : 0.55 }}>Detectar</button>
              </div>

              {dupResult && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ color: dupResult.totalGroups > 0 ? '#b45309' : '#15803d', fontWeight: 700 }}>
                    {dupResult.totalGroups} valor(es) duplicado(s) · {dupResult.totalRows} linha(s) envolvidas
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12, maxHeight: 360, overflow: 'auto' }}>
                    {dupResult.duplicates.slice(0, 200).map((g) => (
                      <div key={g.value} style={{ padding: 10, border: '1px solid #e2e8f0', borderRadius: 6, backgroundColor: '#f8fafc', fontSize: 14 }}>
                        <strong>{g.value}</strong> — {g.rows.length}× (linhas {g.rows.slice(0, 30).join(', ')}{g.rows.length > 30 ? '…' : ''})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {sheetA && sheetB && (
            <section style={sectionStyle}>
              <h2 style={{ marginTop: 0 }}>🔎 Cruzamento de Colunas (A × B)</h2>
              <p style={{ margin: '0 0 14px', color: '#475569', fontSize: 14 }}>
                Acha valores da coluna da Planilha A que aparecem numa coluna da Planilha B —
                útil pra detectar dado na coluna errada.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) auto', gap: 10, alignItems: 'end' }}>
                <label><span style={labelStyle}>Coluna (A)</span><ColumnSelect value={crossColA} options={sheetA.headers} onChange={setCrossColA} /></label>
                <label><span style={labelStyle}>Coluna (B)</span><ColumnSelect value={crossColB} options={sheetB.headers} onChange={setCrossColB} /></label>
                <label><span style={labelStyle}>Tratamento</span><TransformSelect value={crossTransform} onChange={setCrossTransform} /></label>
                <button type="button" onClick={runCross} disabled={!crossColA || !crossColB} style={{ ...primaryButtonStyle, opacity: crossColA && crossColB ? 1 : 0.55 }}>Cruzar</button>
              </div>

              {crossResult && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ color: crossResult.totalMatched > 0 ? '#b45309' : '#15803d', fontWeight: 700 }}>
                    {crossResult.totalMatched} valor(es) cruzaram entre as duas colunas
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12, maxHeight: 360, overflow: 'auto' }}>
                    {crossResult.matches.slice(0, 200).map((m) => (
                      <div key={m.value} style={{ padding: 10, border: '1px solid #e2e8f0', borderRadius: 6, backgroundColor: '#f8fafc', fontSize: 14 }}>
                        <strong>{m.value}</strong> — A: linha(s) {m.rowsA.slice(0, 20).join(', ')} · B: linha(s) {m.rowsB.slice(0, 20).join(', ')}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
