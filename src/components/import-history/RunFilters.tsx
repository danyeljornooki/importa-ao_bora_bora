import type { ImportRunFilters } from '../../types/importHistory.types';

interface RunFiltersProps {
  value: ImportRunFilters;
  loading?: boolean;
  onChange: (filters: ImportRunFilters) => void;
  onApply: () => void;
  onClear: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '9px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
};

export function RunFilters({
  value,
  loading,
  onChange,
  onApply,
  onClear,
}: RunFiltersProps) {
  const setField = (field: keyof ImportRunFilters, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  return (
    <section style={{ padding: 18, border: '1px solid #dbe2ea', borderRadius: 10, background: '#fff' }}>
      <h2 style={{ marginTop: 0 }}>Filtros</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <label>
          <span>Pesquisar</span>
          <input
            value={value.search ?? ''}
            onChange={(event) => setField('search', event.target.value)}
            placeholder="Run ID, arquivo ou store"
            style={inputStyle}
          />
        </label>
        <label>
          <span>Store ID</span>
          <input value={value.storeId ?? ''} onChange={(event) => setField('storeId', event.target.value)} style={inputStyle} />
        </label>
        <label>
          <span>Status</span>
          <select value={value.status ?? ''} onChange={(event) => setField('status', event.target.value)} style={inputStyle}>
            <option value="">Todos</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </label>
        <label>
          <span>Data inicial</span>
          <input type="date" value={value.dateFrom ?? ''} onChange={(event) => setField('dateFrom', event.target.value)} style={inputStyle} />
        </label>
        <label>
          <span>Data final</span>
          <input type="date" value={value.dateTo ?? ''} onChange={(event) => setField('dateTo', event.target.value)} style={inputStyle} />
        </label>
        <label>
          <span>Arquivo</span>
          <input value={value.fileName ?? ''} onChange={(event) => setField('fileName', event.target.value)} style={inputStyle} />
        </label>
        <label>
          <span>Run ID</span>
          <input value={value.runId ?? ''} onChange={(event) => setField('runId', event.target.value)} style={inputStyle} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button type="button" onClick={onApply} disabled={loading} style={{ padding: '9px 14px' }}>
          {loading ? 'Carregando...' : 'Aplicar filtros'}
        </button>
        <button type="button" onClick={onClear} disabled={loading} style={{ padding: '9px 14px' }}>
          Limpar
        </button>
      </div>
    </section>
  );
}
