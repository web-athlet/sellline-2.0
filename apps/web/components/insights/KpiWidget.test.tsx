import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KpiWidget } from './KpiWidget';
import type { ReportResult } from '@/lib/insights-api';

const makeReport = (summaryOverrides: Record<string, number | string> = {}): ReportResult => ({
  labels: [],
  datasets: [],
  summary: { conversionRate: 42, totalWon: 10, ...summaryOverrides },
});

describe('KpiWidget', () => {
  it('renders the title', () => {
    render(<KpiWidget title="Konversionsrate" summaryKey="conversionRate" report={makeReport()} />);
    expect(screen.getByText('Konversionsrate')).toBeTruthy();
  });

  it('renders the value from summary', () => {
    render(
      <KpiWidget
        title="Rate"
        summaryKey="conversionRate"
        report={makeReport({ conversionRate: 75 })}
      />,
    );
    expect(screen.getByText('75')).toBeTruthy();
  });

  it('renders unit when provided', () => {
    render(
      <KpiWidget
        title="Rate"
        summaryKey="conversionRate"
        report={makeReport({ conversionRate: 50 })}
        unit="%"
      />,
    );
    expect(screen.getByText('%')).toBeTruthy();
  });

  it('renders description when provided', () => {
    render(
      <KpiWidget
        title="Rate"
        summaryKey="conversionRate"
        report={makeReport()}
        description="Letzter Monat"
      />,
    );
    expect(screen.getByText('Letzter Monat')).toBeTruthy();
  });

  it('renders 0 when report is undefined', () => {
    render(<KpiWidget title="Rate" summaryKey="conversionRate" />);
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('renders 0 when summaryKey not in report', () => {
    render(<KpiWidget title="Rate" summaryKey="nonExistent" report={makeReport()} />);
    expect(screen.getByText('0')).toBeTruthy();
  });
});
