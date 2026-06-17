import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PWAUpdatePrompt } from './PWAUpdatePrompt';

/** Minimal mutable stand-in for a ServiceWorker (EventTarget + state + postMessage). */
function makeWorker(state: ServiceWorker['state'] = 'installing') {
  const target = new EventTarget();
  return Object.assign(target, {
    state,
    postMessage: vi.fn(),
  }) as unknown as ServiceWorker & {
    state: ServiceWorker['state'];
    postMessage: ReturnType<typeof vi.fn>;
  };
}

interface FakeRegistration {
  waiting: ServiceWorker | null;
  installing: ServiceWorker | null;
  el: EventTarget;
}

function installServiceWorkerMock(opts: {
  hasController?: boolean;
  registration?: FakeRegistration | null;
}) {
  const reg = opts.registration ?? null;
  const swContainer = {
    controller: opts.hasController ? {} : null,
    getRegistration: vi.fn().mockResolvedValue(
      reg
        ? Object.assign(reg.el, {
            waiting: reg.waiting,
            installing: reg.installing,
          })
        : undefined,
    ),
  };
  Object.defineProperty(navigator, 'serviceWorker', {
    value: swContainer,
    configurable: true,
    writable: true,
  });
  return swContainer;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
});

describe('PWAUpdatePrompt', () => {
  it('renders nothing when no registration exists', async () => {
    installServiceWorkerMock({ hasController: true, registration: null });
    const { container } = render(<PWAUpdatePrompt />);
    await waitFor(() => {
      expect(navigator.serviceWorker.getRegistration).toHaveBeenCalled();
    });
    expect(container.firstChild).toBeNull();
  });

  it('shows the prompt when a worker is already waiting and a controller is active', async () => {
    const waiting = makeWorker('installed');
    installServiceWorkerMock({
      hasController: true,
      registration: { waiting, installing: null, el: new EventTarget() },
    });
    render(<PWAUpdatePrompt />);
    expect(await screen.findByTestId('pwa-update-prompt')).toBeInTheDocument();
    expect(screen.getByText('Neue Version verfügbar.')).toBeInTheDocument();
  });

  it('does not prompt on first install (no active controller)', async () => {
    const waiting = makeWorker('installed');
    installServiceWorkerMock({
      hasController: false,
      registration: { waiting, installing: null, el: new EventTarget() },
    });
    const { container } = render(<PWAUpdatePrompt />);
    await waitFor(() => expect(navigator.serviceWorker.getRegistration).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it('surfaces an update found after mount (updatefound → installed)', async () => {
    const installing = makeWorker('installing');
    const el = new EventTarget();
    installServiceWorkerMock({
      hasController: true,
      registration: { waiting: null, installing, el },
    });
    render(<PWAUpdatePrompt />);
    await waitFor(() => expect(navigator.serviceWorker.getRegistration).toHaveBeenCalled());

    act(() => {
      el.dispatchEvent(new Event('updatefound'));
      (installing as unknown as { state: string }).state = 'installed';
      installing.dispatchEvent(new Event('statechange'));
    });

    expect(await screen.findByTestId('pwa-update-prompt')).toBeInTheDocument();
  });

  it('posts SKIP_WAITING and reloads when the user opts in', async () => {
    const waiting = makeWorker('installed');
    installServiceWorkerMock({
      hasController: true,
      registration: { waiting, installing: null, el: new EventTarget() },
    });
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      configurable: true,
      writable: true,
    });

    render(<PWAUpdatePrompt />);
    fireEvent.click(await screen.findByRole('button', { name: 'Jetzt aktualisieren' }));

    expect(
      (waiting as unknown as { postMessage: ReturnType<typeof vi.fn> }).postMessage,
    ).toHaveBeenCalledWith({
      type: 'SKIP_WAITING',
    });
    expect(reload).toHaveBeenCalled();
  });
});
