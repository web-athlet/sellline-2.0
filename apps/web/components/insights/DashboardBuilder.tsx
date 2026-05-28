'use client';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { useCallback, useEffect, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { GridLayout, verticalCompactor, type LayoutItem, type Layout } from 'react-grid-layout';
import { getReport, insightsKeys, type ReportType } from '@/lib/insights-api';
import { AiInsightCard } from './AiInsightCard';
import { ChartWidget } from './ChartWidget';
import { KpiWidget } from './KpiWidget';

const STORAGE_KEY = 'insights-layout-v1';
const COLS = 12;
const ROW_HEIGHT = 150;

interface WidgetDef {
  id: string;
  reportType?: ReportType;
  widgetType: 'kpi' | 'bar' | 'line' | 'pie' | 'funnel' | 'table' | 'ai';
  title: string;
  summaryKey?: string;
  unit?: string;
}

const WIDGETS: WidgetDef[] = [
  {
    id: 'kpi-conversion',
    reportType: 'dealConversionRate',
    widgetType: 'kpi',
    title: 'Konversionsrate',
    summaryKey: 'conversionRate',
    unit: '%',
  },
  {
    id: 'kpi-revenue',
    reportType: 'revenueByUser',
    widgetType: 'kpi',
    title: 'Gesamtumsatz',
    summaryKey: 'totalRevenue',
    unit: '€',
  },
  {
    id: 'kpi-winrate',
    reportType: 'wonVsLostDeals',
    widgetType: 'kpi',
    title: 'Win-Rate',
    summaryKey: 'winRate',
    unit: '%',
  },
  {
    id: 'chart-conversion',
    reportType: 'dealConversionRate',
    widgetType: 'bar',
    title: 'Deal-Konversionsrate',
  },
  {
    id: 'chart-forecast',
    reportType: 'revenueForecast',
    widgetType: 'line',
    title: 'Umsatz-Prognose (90 Tage)',
  },
  {
    id: 'chart-activities',
    reportType: 'activityPerformance',
    widgetType: 'bar',
    title: 'Aktivitäts-Performance',
  },
  {
    id: 'chart-wonlost',
    reportType: 'wonVsLostDeals',
    widgetType: 'bar',
    title: 'Gewonnen vs. Verloren',
  },
  {
    id: 'chart-velocity',
    reportType: 'pipelineVelocity',
    widgetType: 'bar',
    title: 'Pipeline-Geschwindigkeit',
  },
  { id: 'chart-leads', reportType: 'leadSources', widgetType: 'pie', title: 'Lead-Quellen' },
  {
    id: 'chart-email',
    reportType: 'emailPerformance',
    widgetType: 'line',
    title: 'E-Mail-Performance',
  },
  {
    id: 'chart-revenue',
    reportType: 'revenueByUser',
    widgetType: 'bar',
    title: 'Umsatz nach Mitarbeiter',
  },
  { id: 'ai-loss', widgetType: 'ai', title: 'KI-Verlust-Analyse' },
];

const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: 'kpi-conversion', x: 0, y: 0, w: 4, h: 1 },
  { i: 'kpi-revenue', x: 4, y: 0, w: 4, h: 1 },
  { i: 'kpi-winrate', x: 8, y: 0, w: 4, h: 1 },
  { i: 'chart-conversion', x: 0, y: 1, w: 6, h: 2 },
  { i: 'chart-forecast', x: 6, y: 1, w: 6, h: 2 },
  { i: 'chart-activities', x: 0, y: 3, w: 4, h: 2 },
  { i: 'chart-wonlost', x: 4, y: 3, w: 4, h: 2 },
  { i: 'chart-velocity', x: 8, y: 3, w: 4, h: 2 },
  { i: 'chart-leads', x: 0, y: 5, w: 3, h: 2 },
  { i: 'chart-email', x: 3, y: 5, w: 5, h: 2 },
  { i: 'chart-revenue', x: 8, y: 5, w: 4, h: 2 },
  { i: 'ai-loss', x: 0, y: 7, w: 12, h: 2 },
];

function loadLayout(): LayoutItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as LayoutItem[];
  } catch {
    // ignore parse errors
  }
  return DEFAULT_LAYOUT;
}

function saveLayout(layout: LayoutItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ignore storage errors
  }
}

export function DashboardBuilder() {
  const { data: session } = useSession();
  const [layout, setLayout] = useState<LayoutItem[]>(DEFAULT_LAYOUT);
  const [containerWidth, setContainerWidth] = useState(1200);

  useEffect(() => {
    setLayout(loadLayout());
    const el = document.getElementById('dashboard-container');
    if (el) setContainerWidth(el.offsetWidth);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const reportWidgets = WIDGETS.filter((w) => w.reportType);
  const reportTypes = [...new Set(reportWidgets.map((w) => w.reportType!))] as ReportType[];

  const queries = useQueries({
    queries: reportTypes.map((type) => ({
      queryKey: insightsKeys.report(type, {}),
      queryFn: () => getReport(type, {}, session?.accessToken),
      enabled: !!session?.accessToken,
      staleTime: 1000 * 60 * 5,
    })),
  });

  const reportMap = Object.fromEntries(reportTypes.map((type, i) => [type, queries[i]]));

  const handleLayoutChange = useCallback((newLayout: Layout) => {
    const mutable = [...newLayout] as LayoutItem[];
    setLayout(mutable);
    saveLayout(mutable);
  }, []);

  return (
    <div id="dashboard-container" className="w-full">
      <GridLayout
        layout={layout}
        width={containerWidth}
        onLayoutChange={handleLayoutChange}
        compactor={verticalCompactor}
        gridConfig={{
          cols: COLS,
          rowHeight: ROW_HEIGHT,
          margin: [12, 12],
          containerPadding: [0, 0],
        }}
        dragConfig={{ enabled: true, handle: '.drag-handle' }}
        resizeConfig={{ enabled: true }}
      >
        {WIDGETS.map((widget) => {
          const query = widget.reportType ? reportMap[widget.reportType] : undefined;

          return (
            <div key={widget.id} className="group">
              <div className="drag-handle absolute top-2 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-slate-200 opacity-0 group-hover:opacity-100 cursor-grab transition-opacity z-10" />
              {widget.widgetType === 'ai' ? (
                <AiInsightCard />
              ) : widget.widgetType === 'kpi' ? (
                <KpiWidget
                  title={widget.title}
                  report={query?.data}
                  summaryKey={widget.summaryKey ?? ''}
                  unit={widget.unit}
                />
              ) : (
                <ChartWidget
                  title={widget.title}
                  type={widget.widgetType as 'bar' | 'line' | 'pie' | 'funnel' | 'table'}
                  report={query?.data}
                  isLoading={query?.isLoading}
                />
              )}
            </div>
          );
        })}
      </GridLayout>
    </div>
  );
}
