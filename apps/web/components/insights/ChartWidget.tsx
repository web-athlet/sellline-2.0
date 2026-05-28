'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ReportResult } from '@/lib/insights-api';

type ChartType = 'bar' | 'line' | 'pie' | 'funnel' | 'table';

interface ChartWidgetProps {
  title: string;
  type: ChartType;
  report?: ReportResult;
  isLoading?: boolean;
}

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7'];

function SkeletonChart() {
  return (
    <div className="flex items-center justify-center h-40 animate-pulse bg-slate-50 rounded-lg">
      <div className="text-slate-300 text-sm">Lade Daten…</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
      Keine Daten im gewählten Zeitraum
    </div>
  );
}

function BarChartView({ report }: { report: ReportResult }) {
  const data = report.labels.map((label, i) => {
    const row: Record<string, number | string> = { label };
    report.datasets.forEach((ds) => {
      row[ds.label] = ds.data[i] ?? 0;
    });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {report.datasets.map((ds, i) => (
          <Bar
            key={ds.label}
            dataKey={ds.label}
            fill={COLORS[i % COLORS.length]}
            radius={[2, 2, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartView({ report }: { report: ReportResult }) {
  const data = report.labels.map((label, i) => {
    const row: Record<string, number | string> = { label };
    report.datasets.forEach((ds) => {
      row[ds.label] = ds.data[i] ?? 0;
    });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {report.datasets.map((ds, i) => (
          <Line
            key={ds.label}
            type="monotone"
            dataKey={ds.label}
            stroke={COLORS[i % COLORS.length]}
            dot={false}
            strokeWidth={2}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function PieChartView({ report }: { report: ReportResult }) {
  const ds = report.datasets[0];
  if (!ds) return <EmptyState />;
  const data = report.labels.map((name, i) => ({ name, value: ds.data[i] ?? 0 }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={60}
          label={({ name, percent }: { name?: string; percent?: number }) =>
            `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
          }
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

function FunnelChartView({ report }: { report: ReportResult }) {
  const ds = report.datasets[0];
  if (!ds) return <EmptyState />;
  const data = report.labels.map((name, i) => ({
    name,
    value: ds.data[i] ?? 0,
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <FunnelChart>
        <Tooltip />
        <Funnel dataKey="value" data={data} isAnimationActive />
      </FunnelChart>
    </ResponsiveContainer>
  );
}

function TableView({ report }: { report: ReportResult }) {
  return (
    <div className="overflow-auto h-40">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left py-1 px-2 text-slate-500">Label</th>
            {report.datasets.map((ds) => (
              <th key={ds.label} className="text-right py-1 px-2 text-slate-500">
                {ds.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.labels.map((label, i) => (
            <tr key={label} className="border-b border-slate-50 hover:bg-slate-50">
              <td className="py-1 px-2 text-slate-700">{label}</td>
              {report.datasets.map((ds) => (
                <td key={ds.label} className="py-1 px-2 text-right text-slate-900 font-medium">
                  {(ds.data[i] ?? 0).toLocaleString('de-DE')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChartWidget({ title, type, report, isLoading }: ChartWidgetProps) {
  const isEmpty = !report || report.labels.length === 0;

  return (
    <div className="h-full flex flex-col p-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
      <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">{title}</h3>
      {isLoading ? (
        <SkeletonChart />
      ) : isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {type === 'bar' && <BarChartView report={report} />}
          {type === 'line' && <LineChartView report={report} />}
          {type === 'pie' && <PieChartView report={report} />}
          {type === 'funnel' && <FunnelChartView report={report} />}
          {type === 'table' && <TableView report={report} />}
        </>
      )}
      {report && (
        <div className="mt-2 flex gap-3 flex-wrap">
          {Object.entries(report.summary).map(([k, v]) => (
            <span key={k} className="text-xs text-slate-500">
              <span className="font-medium text-slate-700">{String(v)}</span>{' '}
              {k.replace(/([A-Z])/g, ' $1').toLowerCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
