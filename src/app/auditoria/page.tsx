'use client';

import React, { useState } from 'react';
import { AppNavigation } from '../../components/AppNavigation';
import { parseImportFile } from '../../modules/importer/parseImportFile';
import type { ValueTransform } from '../../modules/importer/diagnostics';
import {
  compareTables,
  type AuditConfig,
  type AuditFieldMapping,
  type AuditResult,
  type AuditRecord,
} from '../../modules/audit/compareTables';

const sectionStyle: React.CSSProperties = {
  padding: 20,
  border: '1px solid #dbe2ea',
  borderRadius: 10,
  backgroundColor: '#fff',
  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
};
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 8, color: '#334155', fontSize: 14, fontWeight: 600 };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 };
const primaryButtonStyle: React.CSSProperties = { padding: '11px 18px', border: 0, borderRadius: 6, backgroundColor: '#1d4ed8', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' };

const TRANSFORMS: { value: ValueTransform; label: string }[] = [
  { value: 'none', label: 'Nenhum' },
  { value: 'digits', label: 'Apenas dígitos' },
  { value: 'letters', label: 'Apenas letras' },
  { value: 'alphanumeric', label: 'Alfanumérico' },
  { value: 'text', label: 'Texto (sem acento)' },
];

interface LoadedSheet { name: string; headers: string[]; rows: Record<string, unknown>[]; }

const loadSheet = async (file: File): Promise<LoadedSheet> => {
  const parsed = await parseImportFile(file, { fileName: file.name });
  const headerSet = new Set<string>();
  parsed.rows.forEach((row) => Object.keys(row as Record<string, unknown>).forEach((k) => headerSet.add(k)));
  return { name: file.name, headers: Array.from(headerSet), rows: parsed.rows as Record<string, unknown>[] };
};

type FilterKey = 'divergent' | 'matched' | 'onlyInA' | 'onlyInB';

const Metric = ({ label, value, tone }: { label: string; value: number | string; tone?: string }) => (
  <div style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 8, backgroundColor: '#f8fafc' }}>
    <div style={{ color: '#64748b', fontSize: 12, textTransform: 'uppercase' }}>{label}</div>
    <div style={{ marginTop: 4, color: tone ?? '#0f172a', fontSize: 22, fontWeight: 700 }}>{value}</div>
  </div>
);

export default function AuditoriaPage() {
  const [sheetA, setSheetA] = useState<LoadedSheet | null>(null);
  const [sheetB, setSheetB] = useState<LoadedSheet | null>(null);
  const [keyA, setKeyA] = useState('');
  const [keyB, setKeyB] = useState('');
  const [keyTransform, setKeyTransform] = useState<ValueTransform>('none');
  const [fields, setFields] = useState<AuditFieldMapping[]>([]);
  const [newField, setNewField] = useState<{ colA: string; colB: string; transform: ValueTransform }>({ colA: '', colB: '', transform: 'none' });
  const [result, setResult] = useState<AuditResult | null>(null);
  const [filter, setFilter] = useState<FilterKey>('divergent');
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setResult(null); setError(null); };

  const onSelectA = async (file: File | null) => {
    reset(); setFields([]); setKeyA('');
    if (!file) return setSheetA(null);
    try { setSheetA(await loadSheet(file)); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const onSelectB = async (file: File | null) => {
    reset(); setFields([]); setKeyB('');
    if (!file) return setSheetB(null);
    try { setSheetB(await loadSheet(file)); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const addField = () => {
    if (!newField.colA || !newField.colB) return;
    setFields((c) => [...c, { label: newField.colA, colA: newField.colA, colB: newField.colB, transform: newField.transform }]);
    setNewField({ colA: '', colB: '', transform: 'none' });
    reset();
  };
  const removeField = (i: number) => { setFields((c) => c.filter((_, idx) => idx !== i)); reset(); };

  const runCompare = () => {
    if (!sheetA || !sheetB || !keyA || !keyB) return;
    const config: AuditConfig = { keyA, keyB, keyTransform, fields };
    setResult(compareTables(sheetA.rows, sheetB.rows, config));
    setFilter('divergent');
  };

  const records: AuditRecord[] = result
    ? filter === 'divergent' ? result.divergent
    : filter === 'matched' ? result.matched
    : filter === 'onlyInA' ? result.onlyInA
    : result.onlyInB
    : [];

  return (
    <main style={{ minHeight: '100vh', padding: '32px 20px 56px', backgroundColor: '#f1f5f9', color: '#0f172a', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 1080, margin: '0 auto' }}>
        <AppNavigation />
        <header style={{ marginBottom: 24 }}>
          <div style={{ color: '#2563eb', fontSize: 13, fontWeight: 700 }}>Ferramentas</div>
          <h1 style={{ margin: '6px 0 8px', fontSize: 32 }}>Auditoria de Importação</h1>
          <p style={{ margin: 0, color: '#475569' }}>
            Compare a planilha de origem do cliente (A) com a planilha exportada do sistema (B) e
            confira o que foi importado: idênticas, divergentes, só em A (não importadas) e só em B.
          </p>
        </header>

        <div style={{ display: 'grid', gap: 18 }}>
          <section style={sectionStyle}>
            <h2 style={{ marginTop: 0 }}>1. Planilhas</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div>
                <span style={labelStyle}>Planilha A — origem do cliente</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => void onSelectA(e.target.files?.[0] ?? null)} />
                <div style={{ marginTop: 8, color: sheetA ? '#0f172a' : '#64748b', fontSize: 13 }}>
                  {sheetA ? `${sheetA.name} — ${sheetA.rows.length} linhas` : 'nenhum arquivo'}
                </div>
              </div>
              <div>
                <span style={labelStyle}>Planilha B — exportada do sistema</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => void onSelectB(e.target.files?.[0] ?? null)} />
                <div style={{ marginTop: 8, color: sheetB ? '#0f172a' : '#64748b', fontSize: 13 }}>
                  {sheetB ? `${sheetB.name} — ${sheetB.rows.length} linhas` : 'nenhum arquivo'}
                </div>
              </div>
            </div>
            {error && <div style={{ marginTop: 12, color: '#b91c1c' }}>{error}</div>}
          </section>

          {sheetA && sheetB && (
            <section style={sectionStyle}>
              <h2 style={{ marginTop: 0 }}>2. Chave e Campos</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
                <label><span style={labelStyle}>Coluna-chave (A)</span>
                  <select value={keyA} onChange={(e) => { setKeyA(e.target.value); reset(); }} style={inputStyle}>
                    <option value="">— escolher —</option>
                    {sheetA.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
                <label><span style={labelStyle}>Coluna-chave (B)</span>
                  <select value={keyB} onChange={(e) => { setKeyB(e.target.value); reset(); }} style={inputStyle}>
                    <option value="">— escolher —</option>
                    {sheetB.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
                <label><span style={labelStyle}>Tratamento da chave</span>
                  <select value={keyTransform} onChange={(e) => { setKeyTransform(e.target.value as ValueTransform); reset(); }} style={inputStyle}>
                    {TRANSFORMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </label>
              </div>

              <h3 style={{ marginBottom: 8 }}>Campos a comparar (opcional)</h3>
              {fields.length > 0 && (
                <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                  {fields.map((f, i) => (
                    <div key={`${f.colA}-${f.colB}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, backgroundColor: '#f8fafc', fontSize: 14 }}>
                      <span><strong>{f.colA}</strong> ⟷ <strong>{f.colB}</strong>{f.transform && f.transform !== 'none' ? ` (${f.transform})` : ''}</span>
                      <button type="button" onClick={() => removeField(i)} style={{ border: '1px solid #fecaca', color: '#b91c1c', backgroundColor: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 13 }}>Remover</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) auto', gap: 10, alignItems: 'end' }}>
                <label><span style={labelStyle}>Campo (A)</span>
                  <select value={newField.colA} onChange={(e) => setNewField((c) => ({ ...c, colA: e.target.value }))} style={inputStyle}>
                    <option value="">— escolher —</option>
                    {sheetA.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
                <label><span style={labelStyle}>Campo (B)</span>
                  <select value={newField.colB} onChange={(e) => setNewField((c) => ({ ...c, colB: e.target.value }))} style={inputStyle}>
                    <option value="">— escolher —</option>
                    {sheetB.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
                <label><span style={labelStyle}>Tratamento</span>
                  <select value={newField.transform} onChange={(e) => setNewField((c) => ({ ...c, transform: e.target.value as ValueTransform }))} style={inputStyle}>
                    {TRANSFORMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </label>
                <button type="button" onClick={addField} disabled={!newField.colA || !newField.colB} style={{ ...primaryButtonStyle, backgroundColor: '#0f766e', opacity: !newField.colA || !newField.colB ? 0.55 : 1 }}>Adicionar campo</button>
              </div>

              <div style={{ marginTop: 18 }}>
                <button type="button" onClick={runCompare} disabled={!keyA || !keyB} style={{ ...primaryButtonStyle, backgroundColor: '#15803d', opacity: keyA && keyB ? 1 : 0.55 }}>⚡ Comparar</button>
              </div>
            </section>
          )}

          {result && (
            <section style={sectionStyle}>
              <h2 style={{ marginTop: 0 }}>3. Resultado</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                <Metric label="Peças A" value={result.summary.totalA} />
                <Metric label="Peças B" value={result.summary.totalB} />
                <Metric label="Idênticas" value={result.summary.matched} tone="#15803d" />
                <Metric label="Divergentes" value={result.summary.divergent} tone="#b45309" />
                <Metric label="Só em A" value={result.summary.onlyInA} tone="#b91c1c" />
                <Metric label="Só em B" value={result.summary.onlyInB} tone="#1d4ed8" />
                <Metric label="Match" value={`${result.summary.matchRate}%`} />
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                {([
                  ['divergent', `⚠️ Divergentes (${result.summary.divergent})`],
                  ['matched', `✅ Idênticas (${result.summary.matched})`],
                  ['onlyInA', `❌ Só em A (${result.summary.onlyInA})`],
                  ['onlyInB', `🔵 Só em B (${result.summary.onlyInB})`],
                ] as Array<[FilterKey, string]>).map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setFilter(key)}
                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 700, fontSize: 13, backgroundColor: filter === key ? '#1d4ed8' : '#fff', color: filter === key ? '#fff' : '#334155' }}>
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gap: 8, marginTop: 14, maxHeight: 420, overflow: 'auto' }}>
                {records.slice(0, 300).map((r) => (
                  <div key={r.key} style={{ padding: 10, border: '1px solid #e2e8f0', borderRadius: 6, backgroundColor: '#f8fafc', fontSize: 13 }}>
                    <div><strong>Chave:</strong> {r.key}</div>
                    {r.differences && r.differences.length > 0 && (
                      <div style={{ marginTop: 4, color: '#b45309' }}>
                        {r.differences.map((d) => (
                          <div key={d.label}>{d.label}: "{String(d.valueA ?? '')}" → "{String(d.valueB ?? '')}"</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {records.length === 0 && <div style={{ color: '#64748b', padding: 12 }}>Nenhum registro neste filtro.</div>}
                {records.length > 300 && <div style={{ color: '#64748b', padding: 8, textAlign: 'center' }}>Mostrando 300 de {records.length}.</div>}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
