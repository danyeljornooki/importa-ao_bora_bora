import type { ImportRunItem } from '../../types/importHistory.types';

interface RunItemsTableProps {
  items: ImportRunItem[];
  showJson: boolean;
}

const payloadValue = (payload: unknown, key: string): unknown => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return (payload as Record<string, unknown>)[key] ?? null;
};

const display = (value: unknown): string =>
  value === null || value === undefined || value === '' ? '-' : String(value);

export function RunItemsTable({ items, showJson }: RunItemsTableProps) {
  if (items.length === 0) {
    return <div style={{ padding: 18, color: '#64748b' }}>Nenhum item encontrado.</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1150 }}>
        <thead>
          <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
            {['Linha', 'Action', 'Execution Status', 'Code', 'ID_INT', 'MLB', 'Título', 'Mensagem', 'Target ID'].map((heading) => (
              <th key={heading} style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const mlbIds = payloadValue(item.payload, 'mlb_ids');
            const mlb = payloadValue(item.payload, 'id_string')
              ?? (Array.isArray(mlbIds) ? mlbIds[0] : null);
            const message = item.executionError
              ?? item.reason
              ?? item.errors.map(String).join(', ');

            return (
              <tr key={item.id || `${item.runId}-${item.row}`}>
                <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{item.row}</td>
                <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{item.action}</td>
                <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{item.executionStatus}</td>
                <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{display(payloadValue(item.payload, 'code'))}</td>
                <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{display(payloadValue(item.payload, 'id_int'))}</td>
                <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{display(mlb)}</td>
                <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{display(payloadValue(item.payload, 'title') ?? payloadValue(item.payload, 'marketplace_name'))}</td>
                <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{display(message)}</td>
                <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{display(item.targetId)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {showJson && items.map((item) => (
        <details key={`json-${item.id || item.row}`} style={{ marginTop: 8 }}>
          <summary>Linha {item.row}: payload / execution_result</summary>
          <pre style={{ overflow: 'auto', padding: 12, background: '#f8fafc' }}>
{JSON.stringify({ payload: item.payload, execution_result: item.executionResult }, null, 2)}
          </pre>
        </details>
      ))}
    </div>
  );
}
