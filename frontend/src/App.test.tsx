import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import apiService from './services/apiService';

vi.mock('./services/apiService', () => ({
  default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}));

// MapLibre needs real canvas/WebGL support that jsdom doesn't provide -
// several routes exercised below (Citizen Portal's Find Parcels, Officer
// Portal's Map) render MapComponent, so it must be stubbed out the same way
// it is wherever else the app shell gets rendered around a page that
// includes the map.
vi.mock('./features/map/MapComponent', () => ({
  default: () => <div data-testid="map-stub" />,
}));
// Same reason - AdminPortal statically imports AdminMapLayerAuthoringPage
// (Admin Map Layer Authoring), which pulls in LayerGeometryDrawMap's own
// maplibre-gl usage, even though no test here navigates to that route.
vi.mock('./features/admin/LayerGeometryDrawMap', () => ({
  default: () => <div data-testid="draw-map-stub" />,
}));

function mockApi() {
  vi.mocked(apiService.get).mockImplementation(async (url: string) => {
    if (url === '/parcels') return { data: { parcels: [] } };
    if (url === '/parcels/mine') return { data: { parcels: [], total: 0 } };
    return { data: [] };
  });
}

// One navbar everywhere, no separate portal-owned sub-nav (the user's
// explicit follow-up: "i dont want 2 diffrent navbars fit the things in the
// orignal navbar only") - a signed-in citizen sees Home/About plus their
// full portal page list (navConfig.ts's CITIZEN_NAV_ITEMS) right in this one
// header; an officer sees their own portal page list only.
function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['auth-me'], { id: 'c1', email: 'citizen1@example.com', name: 'A Citizen', role: 'CITIZEN' });
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
    window.history.pushState({}, '', '/citizen/parcels');
  });

  it('does not render the mobile menu panel until toggled open', () => {
    renderApp();
    expect(document.getElementById('mobile-menu')).not.toBeInTheDocument();
    // The desktop nav link still exists in the DOM (Tailwind hides it via
    // CSS at the lg breakpoint, not by removing it) - there should be
    // exactly one, since the mobile panel hasn't been opened yet.
    expect(screen.getAllByRole('link', { name: 'My Parcels' })).toHaveLength(1);
  });

  it('opens the mobile menu on toggle and closes it again on the second click', () => {
    renderApp();
    const toggle = screen.getByLabelText('Toggle navigation menu');

    fireEvent.click(toggle);
    expect(document.getElementById('mobile-menu')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'My Parcels' })).toHaveLength(2);

    fireEvent.click(toggle);
    expect(document.getElementById('mobile-menu')).not.toBeInTheDocument();
  });

  it('closes the menu when a mobile nav link is clicked, even to the page already open', () => {
    renderApp();
    fireEvent.click(screen.getByLabelText('Toggle navigation menu'));

    const mobileMenu = document.getElementById('mobile-menu')!;
    // Already on /citizen/parcels - clicking its own link changes nothing
    // about the location, so the menu must close on click itself, not via a
    // pathname-change effect.
    fireEvent.click(within(mobileMenu).getByRole('link', { name: 'My Parcels' }));

    expect(document.getElementById('mobile-menu')).not.toBeInTheDocument();
  });
});

describe('App navbar is per-role, not just per-guest', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(apiService.get).mockReset();
    mockApi();
    window.history.pushState({}, '', '/');
  });

  function renderAs(role: string) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['auth-me'], { id: 'u1', email: 'user@example.com', name: 'A User', role });
    return render(
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>,
    );
  }

  it("a citizen sees Home, About, and their full portal page list - never an officer/admin page", () => {
    renderAs('CITIZEN');
    const nav = within(screen.getByRole('banner'));
    expect(nav.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'About' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'My Parcels' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Raise Request' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Profile' })).toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'Features' })).not.toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'Assigned Requests' })).not.toBeInTheDocument();
  });

  it('a citizen landing on "/" sees the Home page itself, not a redirect to their dashboard', async () => {
    renderAs('CITIZEN');
    expect(await screen.findByText('How BhoomiSetu Works')).toBeInTheDocument();
  });

  it("an officer sees their own portal page list only - no Home/About, no citizen pages", () => {
    renderAs('LAND_RECORD_OFFICER');
    const nav = within(screen.getByRole('banner'));
    expect(nav.getByRole('link', { name: 'Assigned Requests' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Governance Alerts' })).toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'About' })).not.toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'My Parcels' })).not.toBeInTheDocument();
  });

  it("an admin sees their own portal page list only - no Home/About, no citizen/officer pages", () => {
    renderAs('ADMIN');
    const nav = within(screen.getByRole('banner'));
    expect(nav.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Departments' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'System Monitoring' })).toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'Assigned Requests' })).not.toBeInTheDocument();
  });

  it('the navbar never shows the BhoomiSetu logo, for any role', () => {
    renderAs('ADMIN');
    const nav = within(screen.getByRole('banner'));
    expect(nav.queryByAltText('BhoomiSetu Official Logo')).not.toBeInTheDocument();
  });
});

describe('App sign-out', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(apiService.get).mockReset();
    mockApi();
    window.history.pushState({}, '', '/citizen/parcels');
  });

  // Logout is a single global affordance now (the utility bar's "Sign Out"),
  // not duplicated per-portal - OfficerPortal.tsx/CitizenPortal.tsx/
  // AdminPortal.tsx no longer have their own logout button (previously
  // OfficerPortal.tsx and AdminPortal.tsx each did). useLogout()'s own
  // cache-clearing behaviour is unit-tested directly in auth.test.tsx; this
  // covers the UI wiring.
  it('clears the session and returns to the public Home page', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));
    expect(await screen.findByText('How BhoomiSetu Works')).toBeInTheDocument();
  });
});

describe('App guest navbar (docs/FRONTEND_UPGRADE_SPEC.md §2)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(apiService.get).mockReset();
    mockApi();
    window.history.pushState({}, '', '/');
  });

  function renderAsGuest() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>,
    );
  }

  it('shows Home/About/Features and Get Started, not the portal links or search tools', () => {
    renderAsGuest();

    const nav = within(screen.getByRole('banner'));
    expect(nav.getByRole('link', { name: 'About' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Features' })).toBeInTheDocument();
    expect(nav.queryByAltText('BhoomiSetu Official Logo')).not.toBeInTheDocument();
    // "Get Started" appears twice for a guest on "/" - once in the navbar
    // (App.tsx), once in the new HomePage's own hero CTA - both real links
    // to the same place, not a duplicate-content bug.
    const getStartedLinks = screen.getAllByRole('link', { name: 'Get Started' });
    expect(getStartedLinks.length).toBeGreaterThanOrEqual(1);
    getStartedLinks.forEach((link) => expect(link).toHaveAttribute('href', '/register'));
    expect(screen.queryByRole('link', { name: 'Officer Portal' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Admin Portal' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Search local identifier')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('App Switcher')).not.toBeInTheDocument();
  });

  it('the BhoomiSetu logo appears on the Home page itself, not the navbar', () => {
    renderAsGuest();
    expect(screen.getByAltText('BhoomiSetu Official Logo')).toBeInTheDocument();
  });

  it('navigates to the About and Features pages', async () => {
    renderAsGuest();

    fireEvent.click(within(screen.getByRole('banner')).getByRole('link', { name: 'About' }));
    expect(await screen.findByRole('heading', { name: 'About BhoomiSetu' })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('banner')).getByRole('link', { name: 'Features' }));
    expect(await screen.findByRole('heading', { name: 'What BhoomiSetu Does' })).toBeInTheDocument();
  });
});

describe('App auth pages get no main navbar (docs/FRONTEND_UPGRADE_SPEC.md §3)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(apiService.get).mockReset();
    mockApi();
  });

  function renderAt(path: string) {
    window.history.pushState({}, '', path);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>,
    );
  }

  it('shows only a brand-only strip on /login, not Home/About/Features or Get Started', () => {
    renderAt('/login');
    const header = screen.getByRole('banner');
    expect(header.querySelector('img[alt="BhoomiSetu Official Logo"]')).toBeInTheDocument();
    expect(within(header).queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
    expect(within(header).queryByRole('link', { name: 'About' })).not.toBeInTheDocument();
    expect(within(header).queryByRole('link', { name: 'Features' })).not.toBeInTheDocument();
    expect(within(header).queryByRole('link', { name: 'Get Started' })).not.toBeInTheDocument();
  });

  it('shows only a brand-only strip on /register too', () => {
    renderAt('/register');
    const header = screen.getByRole('banner');
    expect(header.querySelector('img[alt="BhoomiSetu Official Logo"]')).toBeInTheDocument();
    expect(within(header).queryByRole('link', { name: 'About' })).not.toBeInTheDocument();
  });

  it('the brand strip links back to the public Home page', () => {
    renderAt('/login');
    const logoLink = screen.getByAltText('BhoomiSetu Official Logo').closest('a');
    expect(logoLink).toHaveAttribute('href', '/');
  });
});
