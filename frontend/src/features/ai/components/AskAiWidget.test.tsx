import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AskAiWidget from './AskAiWidget';
import apiService from '../../../services/apiService';

vi.mock('../../../services/apiService', () => ({
  default: { post: vi.fn() },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderWidget() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AskAiWidget />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function openWidget() {
  fireEvent.click(screen.getByRole('button', { name: 'Open Ask AI' }));
}

function sendMessage(text: string) {
  fireEvent.change(screen.getByPlaceholderText('Ask a question...'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
}

// jsdom (as bundled with this project's vitest) has no PointerEvent
// constructor at all - testing-library's fireEvent.pointerDown/Move/Up fall
// back to a plain Event that never carries clientX/clientY through to
// React's synthetic event, so drag position never actually updates via the
// normal helpers. Building the event by hand and assigning the extra
// properties directly works because React's synthetic-event layer reads
// clientX/clientY/pointerId/button by plain property access, regardless of
// the underlying native event's actual class.
function firePointer(el: Element, type: string, init: { clientX: number; clientY: number; pointerId?: number }) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX: init.clientX, clientY: init.clientY, pointerId: init.pointerId ?? 1, button: 0 });
  fireEvent(el, event);
}

describe('AskAiWidget', () => {
  beforeEach(() => {
    vi.mocked(apiService.post).mockReset();
    mockNavigate.mockReset();
  });

  it('is closed by default, showing only the floating toggle button', () => {
    renderWidget();
    expect(screen.getByRole('button', { name: 'Open Ask AI' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Ask a question...')).not.toBeInTheDocument();
  });

  it('opens to show the intro text and suggestion chips', () => {
    renderWidget();
    openWidget();

    expect(screen.getByText(/Ask about parcel data/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'How do I search for a parcel?' })).toBeInTheDocument();
  });

  it('closes via the panel header close button', () => {
    renderWidget();
    openWidget();
    fireEvent.click(screen.getByRole('button', { name: 'Close Ask AI panel' }));

    expect(screen.queryByPlaceholderText('Ask a question...')).not.toBeInTheDocument();
  });

  it('closes via the floating toggle button too', () => {
    renderWidget();
    openWidget();
    fireEvent.click(screen.getByRole('button', { name: 'Close Ask AI' }));

    expect(screen.queryByPlaceholderText('Ask a question...')).not.toBeInTheDocument();
  });

  it("shows the user's message immediately, before the response arrives", async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    vi.mocked(apiService.post).mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    renderWidget();
    openWidget();

    sendMessage('parcels with overdue tax');
    expect(screen.getByText('parcels with overdue tax')).toBeInTheDocument();
    expect(screen.getByText('Thinking...')).toBeInTheDocument();

    resolveRequest({ data: { intent: 'HELP', reply: 'done' } });
    await screen.findByText('done');
  });

  it('renders a DATA_QUERY reply with matched parcels and a working View button', async () => {
    vi.mocked(apiService.post).mockResolvedValue({
      data: {
        intent: 'DATA_QUERY',
        reply: 'Here are the overdue-tax parcels.',
        filters: { tax_status: 'OVERDUE' },
        totalMatches: 1,
        results: [{ id: 'parcel-123456', canonicalParcelId: 'CAN1', ulpin: null, stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'L1', areaSqM: 100, geometry: '{}' }],
      },
    });
    renderWidget();
    openWidget();

    sendMessage('parcels with overdue tax');

    expect(await screen.findByText('Here are the overdue-tax parcels.')).toBeInTheDocument();
    expect(screen.getByText('1 parcel(s) matched')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(mockNavigate).toHaveBeenCalledWith('/parcels/parcel-123456');
  });

  it('renders a HELP reply with no results section', async () => {
    vi.mocked(apiService.post).mockResolvedValue({
      data: { intent: 'HELP', reply: 'Use the Search Parcels panel and enter a ULPIN.' },
    });
    renderWidget();
    openWidget();

    sendMessage('how do I search for a parcel');

    expect(await screen.findByText('Use the Search Parcels panel and enter a ULPIN.')).toBeInTheDocument();
    expect(screen.queryByText(/parcel\(s\) matched/)).not.toBeInTheDocument();
  });

  it('shows an error-styled message when the request fails', async () => {
    vi.mocked(apiService.post).mockRejectedValue({ isAxiosError: true, response: { status: 500 } });
    renderWidget();
    openWidget();

    sendMessage('anything');

    expect(await screen.findByText(/Sorry, I couldn't process that/)).toBeInTheDocument();
  });

  it('clicking a suggestion chip submits it directly', async () => {
    vi.mocked(apiService.post).mockResolvedValue({ data: { intent: 'HELP', reply: 'Search away.' } });
    renderWidget();
    openWidget();

    fireEvent.click(screen.getByRole('button', { name: 'How do I search for a parcel?' }));

    await waitFor(() => expect(apiService.post).toHaveBeenCalledWith('/ai/query', { query: 'How do I search for a parcel?' }));
    expect(await screen.findByText('Search away.')).toBeInTheDocument();
  });

  describe('dragging', () => {
    it('dragging the toggle button moves it and does not toggle the panel open', () => {
      renderWidget();
      const button = screen.getByRole('button', { name: 'Open Ask AI' });
      const before = { left: button.style.left, top: button.style.top };

      firePointer(button, 'pointerdown', { clientX: 500, clientY: 500 });
      firePointer(button, 'pointermove', { clientX: 400, clientY: 350 });
      firePointer(button, 'pointerup', { clientX: 400, clientY: 350 });

      expect(button.style.left).not.toBe(before.left);
      expect(button.style.top).not.toBe(before.top);
      // A real drag must not also open the panel on release.
      expect(screen.queryByPlaceholderText('Ask a question...')).not.toBeInTheDocument();
    });

    it('a press-and-release with no real movement still toggles the panel open (a click, not a drag)', () => {
      renderWidget();
      const button = screen.getByRole('button', { name: 'Open Ask AI' });

      firePointer(button, 'pointerdown', { clientX: 500, clientY: 500 });
      firePointer(button, 'pointerup', { clientX: 500, clientY: 500 });
      fireEvent.click(button);

      expect(screen.getByPlaceholderText('Ask a question...')).toBeInTheDocument();
    });

    it('dragging the open panel by its header moves it without closing it', () => {
      renderWidget();
      openWidget();
      const header = screen.getByText('Ask AI').closest('div')!;
      const panel = screen.getByPlaceholderText('Ask a question...').closest('div.fixed') as HTMLElement;
      const before = { left: panel.style.left, top: panel.style.top };

      firePointer(header, 'pointerdown', { clientX: 300, clientY: 300, pointerId: 2 });
      firePointer(header, 'pointermove', { clientX: 250, clientY: 220, pointerId: 2 });
      firePointer(header, 'pointerup', { clientX: 250, clientY: 220, pointerId: 2 });

      expect(panel.style.left).not.toBe(before.left);
      expect(panel.style.top).not.toBe(before.top);
      expect(screen.getByPlaceholderText('Ask a question...')).toBeInTheDocument();
    });

    it("the panel header's close button still works and does not start a drag", () => {
      renderWidget();
      openWidget();

      fireEvent.click(screen.getByRole('button', { name: 'Close Ask AI panel' }));

      expect(screen.queryByPlaceholderText('Ask a question...')).not.toBeInTheDocument();
    });
  });
});
