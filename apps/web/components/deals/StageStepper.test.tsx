import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StageStepper } from './StageStepper';

const stages = [
  { id: 's1', name: 'Qualifiziert', color: null, order: 0 },
  { id: 's2', name: 'Demo', color: null, order: 1 },
  { id: 's3', name: 'Angebot', color: null, order: 2 },
];

describe('StageStepper', () => {
  it('marks the current stage with aria-current=step', () => {
    render(<StageStepper stages={stages} currentStageId="s2" onChange={() => {}} />);
    const current = screen.getByRole('button', { name: 'Demo' });
    expect(current.getAttribute('aria-current')).toBe('step');
  });

  it('invokes onChange with the clicked stage id', () => {
    const onChange = vi.fn();
    render(<StageStepper stages={stages} currentStageId="s1" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Angebot' }));
    expect(onChange).toHaveBeenCalledWith('s3');
  });

  it('does not fire onChange when disabled', () => {
    const onChange = vi.fn();
    render(<StageStepper stages={stages} currentStageId="s1" onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Angebot' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
