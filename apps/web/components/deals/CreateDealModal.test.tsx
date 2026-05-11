import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateDealModal } from './CreateDealModal';

const stages = [
  { id: 's1', name: 'Qualifiziert', color: null, order: 0 },
  { id: 's2', name: 'Demo', color: null, order: 1 },
];

describe('CreateDealModal', () => {
  it('requires a title before submitting', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <CreateDealModal pipelineId="p1" stages={stages} onClose={() => {}} onSubmit={onSubmit} />,
    );
    const submitButton = screen.getByRole('button', { name: /deal anlegen/i });
    fireEvent.click(submitButton);
    // browser native required + onSubmit guard → handler never called
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits with title + selected stage', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <CreateDealModal pipelineId="p1" stages={stages} onClose={onClose} onSubmit={onSubmit} />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: /titel/i }), {
      target: { value: 'Mein Deal' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /stage/i }), {
      target: { value: 's2' },
    });
    fireEvent.click(screen.getByRole('button', { name: /deal anlegen/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Mein Deal', stageId: 's2', pipelineId: 'p1' }),
      ),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows API errors inline without closing', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Stage gehört nicht zur Pipeline'));
    const onClose = vi.fn();
    render(
      <CreateDealModal pipelineId="p1" stages={stages} onClose={onClose} onSubmit={onSubmit} />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: /titel/i }), {
      target: { value: 'X' },
    });
    fireEvent.click(screen.getByRole('button', { name: /deal anlegen/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/stage gehört nicht/i));
    expect(onClose).not.toHaveBeenCalled();
  });
});
