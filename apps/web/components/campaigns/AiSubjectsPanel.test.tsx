import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiSubjectsPanel } from './AiSubjectsPanel';

const suggestions = [
  {
    subject: 'Sommer-Spezial: 20% Rabatt!',
    reasoning: 'Dringlichkeit erzeugt',
    estimatedOpenRate: 32,
  },
  { subject: 'Exklusiv für Sie', reasoning: 'Personalisierung', estimatedOpenRate: 28 },
  { subject: 'Das dürfen Sie nicht verpassen', reasoning: 'FOMO-Effekt', estimatedOpenRate: 25 },
];

describe('AiSubjectsPanel', () => {
  it('renders generate button when no suggestions', () => {
    render(
      <AiSubjectsPanel
        suggestions={[]}
        isLoading={false}
        onSelect={vi.fn()}
        onGenerate={vi.fn()}
      />,
    );
    expect(screen.getByText(/generieren/i)).toBeTruthy();
  });

  it('calls onGenerate when button clicked', () => {
    const onGenerate = vi.fn();
    render(
      <AiSubjectsPanel
        suggestions={[]}
        isLoading={false}
        onSelect={vi.fn()}
        onGenerate={onGenerate}
      />,
    );
    fireEvent.click(screen.getByText(/generieren/i));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('shows loading skeletons while loading', () => {
    const { container } = render(
      <AiSubjectsPanel suggestions={[]} isLoading={true} onSelect={vi.fn()} onGenerate={vi.fn()} />,
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders all 3 suggestions', () => {
    render(
      <AiSubjectsPanel
        suggestions={suggestions}
        isLoading={false}
        onSelect={vi.fn()}
        onGenerate={vi.fn()}
      />,
    );
    expect(screen.getByText('Sommer-Spezial: 20% Rabatt!')).toBeTruthy();
    expect(screen.getByText('Exklusiv für Sie')).toBeTruthy();
    expect(screen.getByText('Das dürfen Sie nicht verpassen')).toBeTruthy();
  });

  it('shows estimated open rates', () => {
    render(
      <AiSubjectsPanel
        suggestions={suggestions}
        isLoading={false}
        onSelect={vi.fn()}
        onGenerate={vi.fn()}
      />,
    );
    expect(screen.getByText('~32%')).toBeTruthy();
  });

  it('calls onSelect with subject when clicked', () => {
    const onSelect = vi.fn();
    render(
      <AiSubjectsPanel
        suggestions={suggestions}
        isLoading={false}
        onSelect={onSelect}
        onGenerate={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Sommer-Spezial: 20% Rabatt!'));
    expect(onSelect).toHaveBeenCalledWith('Sommer-Spezial: 20% Rabatt!');
  });

  it('shows reasoning text', () => {
    render(
      <AiSubjectsPanel
        suggestions={suggestions}
        isLoading={false}
        onSelect={vi.fn()}
        onGenerate={vi.fn()}
      />,
    );
    expect(screen.getByText('Dringlichkeit erzeugt')).toBeTruthy();
  });

  it('shows "Neu generieren" when suggestions already exist', () => {
    render(
      <AiSubjectsPanel
        suggestions={suggestions}
        isLoading={false}
        onSelect={vi.fn()}
        onGenerate={vi.fn()}
      />,
    );
    expect(screen.getByText('Neu generieren')).toBeTruthy();
  });
});
