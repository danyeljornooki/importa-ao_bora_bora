import type { ImportRun } from '../../types/importHistory.types';

interface RunSummaryProps {
  run: ImportRun;
  showJson: boolean;
  onToggleJson: () => void;
}

const formatDate = (value: string | null): string =>
  value ? new Date(value).toLocaleString('pt-BR') : '-';

export function RunSummary({ run, showJson, onToggleJson }: RunSummaryProps) {
  const fields = [
    ['Run ID', run.id],
    ['Store', run.storeId],
    ['Status', run.status],
    ['Created At', formatDate(run.createdAt)],
    ['Finished At', formatDate(run.finishedAt)],
    ['Duration', run.durationMs === null ? '-' : `${run.durationMs} ms`],
    ['Engine Version', run.engineVersion],
    ['Adapter', run.adapter],
  ];

  return (
    <section style={{ padding: 20, border: '1px solid #dbe2ea', borderRadius: 10, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Resumo</h2>
        <button type="button" onClick={onToggleJson}>{showJson ? 'Ocultar JSON' : 'Mostrar JSON'}</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 16 }}>
        {fields.map(([label, value]) => (
          <div key={label}>
            <strong>{label}:</strong> {value}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <strong>Summary completo</strong>
        <pre style={{ overflow: 'auto', padding: 12, background: '#f8fafc' }}>
{JSON.stringify(run.summary, null, 2)}
        </pre>
      </div>
      {showJson && (
        <div style={{ display: 'grid', gap: 10 }}>
          <details open>
            <summary>summary</summary>
            <pre style={{ overflow: 'auto', padding: 12, background: '#f8fafc' }}>{JSON.stringify(run.summary, null, 2)}</pre>
          </details>
          <details open>
            <summary>metadata</summary>
            <pre style={{ overflow: 'auto', padding: 12, background: '#f8fafc' }}>{JSON.stringify(run.metadata, null, 2)}</pre>
          </details>
        </div>
      )}
    </section>
  );
}
