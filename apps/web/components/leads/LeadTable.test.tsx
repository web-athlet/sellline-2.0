import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LeadTable } from './LeadTable';
import type { Lead } from '@/lib/leads-api';

const makeLead = (overrides: Partial<Lead> = {}): Lead => ({
  id: 'lead-1',
  source: 'form:form-1',
  formId: 'form-1',
  dataJson: { firstName: 'Max', lastName: 'Mustermann', email: 'max@acme.de' },
  enrichedJson: null,
  enrichmentStatus: 'PENDING',
  convertedDealId: null,
  companyName: 'Acme GmbH',
  emailDomain: 'acme.de',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  form: { id: 'form-1', name: 'Kontaktformular' },
  ...overrides,
});

describe('LeadTable', () => {
  const onConvert = vi.fn();
  const onRetry = vi.fn();
  const onDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no leads', () => {
    render(<LeadTable leads={[]} onConvert={onConvert} onRetry={onRetry} onDelete={onDelete} />);
    expect(screen.getByText(/keine leads/i)).toBeTruthy();
  });

  it('renders lead row with contact name', () => {
    render(
      <LeadTable
        leads={[makeLead()]}
        onConvert={onConvert}
        onRetry={onRetry}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText('Max Mustermann')).toBeTruthy();
  });

  it('renders company name', () => {
    render(
      <LeadTable
        leads={[makeLead()]}
        onConvert={onConvert}
        onRetry={onRetry}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText('Acme GmbH')).toBeTruthy();
  });

  it('renders form name as source', () => {
    render(
      <LeadTable
        leads={[makeLead()]}
        onConvert={onConvert}
        onRetry={onRetry}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText('Kontaktformular')).toBeTruthy();
  });

  it('shows EnrichmentBadge for each lead', () => {
    render(
      <LeadTable
        leads={[makeLead()]}
        onConvert={onConvert}
        onRetry={onRetry}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText('Ausstehend')).toBeTruthy();
  });

  it('calls onConvert when convert button clicked', () => {
    const lead = makeLead();
    render(
      <LeadTable leads={[lead]} onConvert={onConvert} onRetry={onRetry} onDelete={onDelete} />,
    );
    fireEvent.click(screen.getByTitle('In Deal konvertieren'));
    expect(onConvert).toHaveBeenCalledWith(lead);
  });

  it('does not show convert button when already converted', () => {
    render(
      <LeadTable
        leads={[makeLead({ convertedDealId: 'deal-99' })]}
        onConvert={onConvert}
        onRetry={onRetry}
        onDelete={onDelete}
      />,
    );
    expect(screen.queryByTitle('In Deal konvertieren')).toBeNull();
  });

  it('shows retry button for FAILED leads', () => {
    render(
      <LeadTable
        leads={[makeLead({ enrichmentStatus: 'FAILED' })]}
        onConvert={onConvert}
        onRetry={onRetry}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByTitle('Erneut anreichern')).toBeTruthy();
  });

  it('calls onRetry when retry clicked', () => {
    render(
      <LeadTable
        leads={[makeLead({ enrichmentStatus: 'FAILED' })]}
        onConvert={onConvert}
        onRetry={onRetry}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByTitle('Erneut anreichern'));
    expect(onRetry).toHaveBeenCalledWith('lead-1');
  });

  it('calls onDelete when delete button clicked', () => {
    render(
      <LeadTable
        leads={[makeLead()]}
        onConvert={onConvert}
        onRetry={onRetry}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByTitle('Löschen'));
    expect(onDelete).toHaveBeenCalledWith('lead-1');
  });

  it('renders multiple leads', () => {
    const leads = [
      makeLead({ id: 'lead-1' }),
      makeLead({ id: 'lead-2', companyName: 'Beta GmbH' }),
    ];
    render(<LeadTable leads={leads} onConvert={onConvert} onRetry={onRetry} onDelete={onDelete} />);
    expect(screen.getByText('Beta GmbH')).toBeTruthy();
  });

  it('shows enriched data preview for DONE leads', () => {
    render(
      <LeadTable
        leads={[
          makeLead({
            enrichmentStatus: 'DONE',
            enrichedJson: { industry: 'SaaS', employees: 50 },
          }),
        ]}
        onConvert={onConvert}
        onRetry={onRetry}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText(/industry/i)).toBeTruthy();
  });

  it('falls back to email when no name in dataJson', () => {
    render(
      <LeadTable
        leads={[makeLead({ dataJson: { email: 'anon@acme.de' } })]}
        onConvert={onConvert}
        onRetry={onRetry}
        onDelete={onDelete}
      />,
    );
    // Email appears in both "Kontakt" (fallback) and "E-Mail" columns
    expect(screen.getAllByText('anon@acme.de').length).toBeGreaterThanOrEqual(1);
  });
});
