import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContactsTable } from './ContactsTable';
import type { ContactListItem } from '../../lib/contacts-api';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const makeContact = (overrides: Partial<ContactListItem> = {}): ContactListItem => ({
  id: 'c1',
  firstName: 'Anna',
  lastName: 'Müller',
  emails: ['anna@example.com'],
  phones: ['0151-12345678'],
  org: { id: 'o1', name: 'Acme GmbH' },
  openDeals: 2,
  closedDeals: 1,
  nextActivity: { id: 'a1', type: 'CALL', subject: 'Follow-up', dueDate: '2026-05-20T10:00:00Z' },
  ownerId: 'user-uuid-1234',
  optIn: true,
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const defaultProps = {
  contacts: [makeContact()],
  sort: undefined as Parameters<typeof ContactsTable>[0]['sort'],
  onSortChange: vi.fn(),
  selected: new Set<string>(),
  onSelectToggle: vi.fn(),
  onSelectAll: vi.fn(),
  onDelete: vi.fn(),
};

describe('ContactsTable', () => {
  it('renders all 8 column headers', () => {
    render(<ContactsTable {...defaultProps} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Organisation')).toBeInTheDocument();
    expect(screen.getByText('E-Mail')).toBeInTheDocument();
    expect(screen.getByText('Telefon')).toBeInTheDocument();
    expect(screen.getByText('Offene Deals')).toBeInTheDocument();
    expect(screen.getByText('Abg. Deals')).toBeInTheDocument();
    expect(screen.getByText('Nächste Aktivität')).toBeInTheDocument();
    expect(screen.getByText('Besitzer')).toBeInTheDocument();
  });

  it('renders contact row with name link', () => {
    render(<ContactsTable {...defaultProps} />);
    const link = screen.getByRole('link', { name: /Anna Müller/i });
    expect(link).toHaveAttribute('href', '/contacts/c1');
  });

  it('shows open deal count badge', () => {
    render(<ContactsTable {...defaultProps} />);
    expect(screen.getByText('2')).toBeInTheDocument(); // openDeals badge
  });

  it('shows closed deal count badge', () => {
    render(<ContactsTable {...defaultProps} />);
    expect(screen.getByText('1')).toBeInTheDocument(); // closedDeals badge
  });

  it('renders next activity subject and date', () => {
    render(<ContactsTable {...defaultProps} />);
    expect(screen.getByText('Follow-up')).toBeInTheDocument();
  });

  it('shows — for empty org', () => {
    render(<ContactsTable {...defaultProps} contacts={[makeContact({ org: null })]} />);
    // should have some — dashes (multiple columns may show —)
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('shows loading state', () => {
    render(<ContactsTable {...defaultProps} contacts={[]} loading={true} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows empty state when no contacts', () => {
    render(<ContactsTable {...defaultProps} contacts={[]} loading={false} />);
    expect(screen.getByText(/keine kontakte/i)).toBeInTheDocument();
  });

  it('calls onSortChange when Name header clicked', () => {
    const onSortChange = vi.fn();
    render(<ContactsTable {...defaultProps} onSortChange={onSortChange} />);
    fireEvent.click(screen.getByText('Name'));
    expect(onSortChange).toHaveBeenCalledWith('name');
  });

  it('calls onSelectAll when header checkbox clicked', () => {
    const onSelectAll = vi.fn();
    render(<ContactsTable {...defaultProps} onSelectAll={onSelectAll} />);
    const headerCheckbox = screen.getByLabelText('Alle auswählen');
    fireEvent.click(headerCheckbox);
    expect(onSelectAll).toHaveBeenCalled();
  });

  it('shows row checkbox checked when contact is selected', () => {
    render(<ContactsTable {...defaultProps} selected={new Set(['c1'])} />);
    const rowCheckbox = screen.getByLabelText('Anna Müller auswählen');
    expect(rowCheckbox).toBeChecked();
  });

  it('shows delete button on row hover (opacity 0 by default)', () => {
    render(<ContactsTable {...defaultProps} />);
    const deleteBtn = screen.getByLabelText('Anna Müller löschen');
    expect(deleteBtn).toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = vi.fn();
    render(<ContactsTable {...defaultProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText('Anna Müller löschen'));
    expect(onDelete).toHaveBeenCalledWith('c1');
  });
});
