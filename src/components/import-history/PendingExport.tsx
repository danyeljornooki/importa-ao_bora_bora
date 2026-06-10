interface PendingExportProps {
  loading?: boolean;
  onExport: () => void;
}

export function PendingExport({ loading, onExport }: PendingExportProps) {
  return (
    <button type="button" onClick={onExport} disabled={loading} style={{ padding: '9px 14px' }}>
      {loading ? 'Exportando...' : 'Exportar Pendências'}
    </button>
  );
}
