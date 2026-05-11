import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrgTree, type OrgTreeNode } from './OrgTree';

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

const makeNode = (overrides: Partial<OrgTreeNode> = {}): OrgTreeNode => ({
  id: 'o1',
  name: 'Acme GmbH',
  domain: 'acme.de',
  industry: 'Tech',
  employeeCount: 50,
  ...overrides,
});

describe('OrgTree', () => {
  it('shows empty state when nodes is empty', () => {
    render(<OrgTree nodes={[]} />);
    expect(screen.getByText('Keine Organisationen.')).toBeInTheDocument();
  });

  it('renders root node name as link', () => {
    render(<OrgTree nodes={[makeNode()]} />);
    const link = screen.getByRole('link', { name: 'Acme GmbH' });
    expect(link).toHaveAttribute('href', '/organizations/o1');
  });

  it('renders multiple root nodes', () => {
    const nodes = [makeNode({ id: 'o1', name: 'Alpha' }), makeNode({ id: 'o2', name: 'Beta' })];
    render(<OrgTree nodes={nodes} />);
    expect(screen.getByRole('link', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Beta' })).toBeInTheDocument();
  });

  it('renders children when parent has children', () => {
    const child = makeNode({ id: 'c1', name: 'Child Corp', children: [] });
    const parent = makeNode({ id: 'p1', name: 'Parent GmbH', children: [child] });
    render(<OrgTree nodes={[parent]} />);
    expect(screen.getByRole('link', { name: 'Child Corp' })).toBeInTheDocument();
  });

  it('shows expand/collapse button for nodes with children', () => {
    const child = makeNode({ id: 'c1', name: 'Child', children: [] });
    const parent = makeNode({ children: [child] });
    render(<OrgTree nodes={[parent]} />);
    expect(screen.getByLabelText('Einklappen')).toBeInTheDocument();
  });

  it('collapses children on toggle click', () => {
    const child = makeNode({ id: 'c1', name: 'Hidden Child', children: [] });
    const parent = makeNode({ children: [child] });
    render(<OrgTree nodes={[parent]} />);
    fireEvent.click(screen.getByLabelText('Einklappen'));
    expect(screen.queryByRole('link', { name: 'Hidden Child' })).not.toBeInTheDocument();
  });

  it('expands after collapse on second toggle click', () => {
    const child = makeNode({ id: 'c1', name: 'Re-shown Child', children: [] });
    const parent = makeNode({ children: [child] });
    render(<OrgTree nodes={[parent]} />);
    const btn = screen.getByLabelText('Einklappen');
    fireEvent.click(btn);
    fireEvent.click(screen.getByLabelText('Ausklappen'));
    expect(screen.getByRole('link', { name: 'Re-shown Child' })).toBeInTheDocument();
  });
});
