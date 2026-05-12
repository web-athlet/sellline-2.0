import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateActivityModal } from './CreateActivityModal';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { accessToken: 'tok' }, status: 'authenticated' }),
}));

vi.mock('@/lib/activities-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/activities-api')>();
  return {
    ...actual,
    createActivity: vi.fn().mockResolvedValue({}),
    checkConflicts: vi.fn().mockResolvedValue({ conflicts: [] }),
  };
});

function renderModal(props: Partial<React.ComponentProps<typeof CreateActivityModal>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CreateActivityModal open={true} onClose={vi.fn()} {...props} />
    </QueryClientProvider>,
  );
}

describe('CreateActivityModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={qc}>
        <CreateActivityModal open={false} onClose={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders form fields when open', () => {
    renderModal();
    expect(screen.getByText(/neue aktivität/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/demo-termin/i)).toBeTruthy();
  });

  it('shows validation error when no entity linked', async () => {
    renderModal();
    const submitBtn = screen.getByRole('button', { name: /erstellen/i });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByText(/deal.*person.*organisation/i)).toBeTruthy();
    });
  });

  it('calls onClose when X button clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    const closeBtn = screen.getAllByRole('button')[0]!;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('allows selecting activity type tabs', () => {
    renderModal();
    const meetingBtn = screen.getByText('Meeting');
    fireEvent.click(meetingBtn);
    expect(meetingBtn).toBeTruthy();
  });

  it('shows MEETING time fields (Von/Bis labels)', () => {
    renderModal();
    fireEvent.click(screen.getByText('Meeting'));
    // Labels "Von" and "Bis" appear when type is MEETING
    expect(screen.getByText('Von')).toBeTruthy();
    expect(screen.getByText('Bis')).toBeTruthy();
  });

  it('submits when deal ID provided', async () => {
    const { createActivity } = await import('@/lib/activities-api');
    renderModal({ defaultDealId: 'deal-1' });
    fireEvent.change(screen.getByPlaceholderText(/demo-termin/i), {
      target: { value: 'Test Aufgabe' },
    });
    const submitBtn = screen.getByRole('button', { name: /erstellen/i });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(createActivity).toHaveBeenCalled();
    });
  });

  it('shows conflict warning for MEETING type with times', async () => {
    const { checkConflicts } = await import('@/lib/activities-api');
    vi.mocked(checkConflicts).mockResolvedValueOnce({
      conflicts: [
        {
          id: 'c-1',
          subject: 'Anderes Meeting',
          startTime: '2026-05-12T10:00:00Z',
          endTime: '2026-05-12T11:00:00Z',
        },
      ],
    });
    renderModal({ defaultDealId: 'deal-1' });
    fireEvent.click(screen.getByText('Meeting'));
    // datetime-local inputs — query by their container order
    const dateInputs = document.querySelectorAll('input[type="datetime-local"]');
    fireEvent.change(dateInputs[0]!, { target: { value: '2026-05-12T10:00' } });
    fireEvent.change(dateInputs[1]!, { target: { value: '2026-05-12T11:00' } });
    fireEvent.change(screen.getByPlaceholderText(/demo-termin/i), {
      target: { value: 'Konflikt Meeting' },
    });
    fireEvent.click(screen.getByRole('button', { name: /erstellen/i }));
    await waitFor(() => {
      expect(screen.getByText(/terminkollision/i)).toBeTruthy();
    });
  });
});
