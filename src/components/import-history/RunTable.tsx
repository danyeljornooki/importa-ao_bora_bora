import Link from 'next/link';
import type { ImportRun } from '../../types/importHistory.types';

interface RunTableProps {
  runs: ImportRun[];
}

const formatDate = (value: string | null): string =>
  value ? new Date(value).toLocaleString('pt-BR') : '-';

const formatDuration = (durationMs: number | null): string => {
  if (durationMs === null) return '-';
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
};

export function RunTable({ runs }: RunTableProps) {
  if (runs.length === 0) {
    return <div style={{ padding: 20, color: '#64748b' }}>Nenhuma importação encontrada.</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1450 }}>
        <thead>
          <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
            {['Data', 'Store', 'Status', 'Arquivo', 'Rows', 'Creates', 'Updates', 'Skipped', 'Conflicts', 'Invalid', 'Failed', 'Duration', 'Engine Version', 'Adapter', 'Ações'].map((heading) => (
              <th key={heading} style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id}>
              <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{formatDate(run.createdAt)}</td>
              <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{run.storeId}</td>
              <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{run.status}</td>
              <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{run.fileName ?? '-'}</td>
              <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{run.totalRows}</td>
              <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{run.creates}</td>
              <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{run.updates}</td>
              <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{run.skipped}</td>
              <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{run.conflicts}</td>
              <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{run.invalid}</td>
              <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{run.failed}</td>
              <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{formatDuration(run.durationMs)}</td>
              <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{run.engineVersion}</td>
              <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>{run.adapter}</td>
              <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                <Link href={`/importacoes/historico/${run.id}`}>Ver detalhes</Link>
                {' | '}
                <Link href={`/importacoes/historico/${run.id}`}>Abrir Run</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
