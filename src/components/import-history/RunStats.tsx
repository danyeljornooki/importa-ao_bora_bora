import type { ImportRunStats } from '../../types/importHistory.types';

interface RunStatsProps {
  stats: ImportRunStats;
}

const labels: Array<[keyof ImportRunStats, string]> = [
  ['totalRuns', 'Total Runs'],
  ['totalCreates', 'Total Creates'],
  ['totalUpdates', 'Total Updates'],
  ['totalSkipped', 'Total Skipped'],
  ['totalConflicts', 'Total Conflicts'],
  ['totalInvalid', 'Total Invalid'],
  ['totalFailed', 'Total Failed'],
];

export function RunStats({ stats }: RunStatsProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
      {labels.map(([key, label]) => (
        <div key={key} style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
          <div style={{ color: '#64748b', fontSize: 12, textTransform: 'uppercase' }}>{label}</div>
          <div style={{ marginTop: 4, fontSize: 24, fontWeight: 700 }}>{stats[key]}</div>
        </div>
      ))}
    </div>
  );
}
