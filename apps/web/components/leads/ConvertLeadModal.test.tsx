import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConvertLeadModal } from './ConvertLeadModal';
import type { Lead } from '@/lib/leads-api';

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { accessToken: 'token-123', user: { id: 'user-1', name: 'Max', email: 'max@test.de' } },
    status: 'authenticated',
  }),
}));

vi.mock('@/lib/leads-api', () => ({
  convertLead: vi.fn().mockResolvedValue({ person: { id: 'p1' }, deal: { id: 'd1' } }),
  leadsKeys: { all: () => ['leads'] },
}));

vi.mock('@/lib/deals-api', () => ({
  listPipelines: vi.fn().mockResolvedValue([
    {
      id: 'pipe-1',
      name: 'Sales Pipeline',
      stages: [
        { id: 'stage-1', name: 'Qualifiziert', order: 1 },
        { id: 'stage-2', name: 'Demo', order: 2 },
      ],
    },
  ]),
  dealsKeys: { pipelines: () => ['pipelines'] },
}));

const makeLead = (overrides: Partial<Lead> = {}): Lead => ({
  id: 'lead-1',
  source: 'form:form-1',
  formId: 'form-1',
  dataJson: {
    firstName: 'Max',
    lastName: 'Mustermann',
    email: 'max@acme.de',
    company: 'Acme GmbH',
  },
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

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('ConvertLeadModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when lead is null', () => {
    const { container } = renderWithClient(<ConvertLeadModal lead={null} onClose={onClose} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal title when lead is provided', () => {
    renderWithClient(<ConvertLeadModal lead={makeLead()} onClose={onClose} />);
    expect(screen.getAllByText('In Deal konvertieren').length).toBeGreaterThanOrEqual(1);
  });

  it('pre-fills deal title with company name', () => {
    renderWithClient(<ConvertLeadModal lead={makeLead()} onClose={onClose} />);
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const titleInput = inputs.find((i) => i.value.includes('Acme GmbH'));
    expect(titleInput?.value).toBe('Lead: Acme GmbH');
  });

  it('calls onClose when cancel clicked', () => {
    renderWithClient(<ConvertLeadModal lead={makeLead()} onClose={onClose} />);
    fireEvent.click(screen.getByText('Abbrechen'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when X button clicked', () => {
    renderWithClient(<ConvertLeadModal lead={makeLead()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Schließen'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows lead data preview section', () => {
    renderWithClient(<ConvertLeadModal lead={makeLead()} onClose={onClose} />);
    expect(screen.getByText(/lead-daten/i)).toBeTruthy();
  });

  it('shows convert button', () => {
    renderWithClient(<ConvertLeadModal lead={makeLead()} onClose={onClose} />);
    const buttons = screen.getAllByRole('button');
    const convertBtn = buttons.find((b) => b.textContent?.includes('In Deal konvertieren'));
    expect(convertBtn).toBeTruthy();
  });
});
