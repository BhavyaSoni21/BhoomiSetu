import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import apiService from './services/apiService';

vi.mock('./services/apiService', () => ({
  default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}));

// MapLibre needs real canvas/WebGL support that jsdom doesn't provide -
// CitizenPortal (the default route) renders MapComponent, so it must be
// stubbed out for this file the same way it is wherever else the app shell
// gets rendered around a page that includes the map.
vi.mock('./features/map/MapComponent', () => ({
  default: () => <div data-testid="map-stub" />,
}));

function mockApi() {
  vi.mocked(apiService.get).mockImplementation(async (url: string) => {
    if (url === '/parcels') return { data: { parcels: [] } };
    return { data: [] };
  });
}

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

describe('App mobile navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(apiService.get).mockReset();
    mockApi();
    window.history.pushState({}, '', '/');
  });

  it('does not render the mobile menu panel until toggled open', () => {
    renderApp();
    expect(document.getElementById('mobile-menu')).not.toBeInTheDocument();
    // The desktop nav link still exists in the DOM (Tailwind hides it via
    // CSS at the md breakpoint, not by removing it) - there should be
    // exactly one, since the mobile panel hasn't been opened yet.
    expect(screen.getAllByRole('link', { name: 'Officer Portal' })).toHaveLength(1);
  });

  it('opens the mobile menu on toggle and closes it again on the second click', () => {
    renderApp();
    const toggle = screen.getByLabelText('Toggle navigation menu');

    fireEvent.click(toggle);
    expect(document.getElementById('mobile-menu')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Officer Portal' })).toHaveLength(2);

    fireEvent.click(toggle);
    expect(document.getElementById('mobile-menu')).not.toBeInTheDocument();
  });

  it('navigates and closes the menu when a mobile nav link is clicked', async () => {
    renderApp();
    fireEvent.click(screen.getByLabelText('Toggle navigation menu'));

    const mobileMenu = document.getElementById('mobile-menu')!;
    fireEvent.click(within(mobileMenu).getByRole('link', { name: 'Officer Portal' }));

    // No token in localStorage, so RequireAuth redirects /officer -> /login.
    expect(await screen.findByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
    expect(document.getElementById('mobile-menu')).not.toBeInTheDocument();
  });
});
