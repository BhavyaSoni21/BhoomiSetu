import { describe, it, expect, vi, beforeEach } from 'vitest';
import { server } from './mocks/server';
import { http, HttpResponse } from 'msw';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from './test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import apiService from './services/apiService';


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
vi.mock('./features/admin/AdminCombinedLayerMap', () => ({
  default: () => <div data-testid="combined-map-stub" />,
}));
// Lazy-loaded pages are wrapped in <Suspense> - without mocking them, the
// Suspense fallback ('Loading…') can linger in jsdom and cause async findBy*
// queries to time out before the dynamic import resolves.  Stub each page
// with the minimum content the tests assert on.
vi.mock('./pages/HomePage', () => ({
  default: () => (
    <div>
      <img src="/logo.png" alt="BhoomiSetu Official Logo" />
      <h2>How BhoomiSetu Works</h2>
      <a href="/register">Get Started</a>
    </div>
  ),
}));
vi.mock('./pages/AboutPage', () => ({
  default: () => <h1>About BhoomiSetu</h1>,
}));
vi.mock('./pages/FeaturesPage', () => ({
  default: () => <h1>What BhoomiSetu Does</h1>,
}));

function mockApi() {
}

// One navbar everywhere, no separate portal-owned sub-nav (the user's
// explicit follow-up: "i dont want 2 diffrent navbars fit the things in the
// orignal navbar only") - a signed-in citizen sees Home/About plus their
// full portal page list (navConfig.ts's CITIZEN_NAV_ITEMS) right in this one
// header; an officer sees their own portal page list only.
function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['auth-me'], { id: 'c1', email: 'citizen1@example.com', name: 'A Citizen', role: 'CITIZEN' });
  return renderWithProviders(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

describe('App mobile navigation', () => {
  beforeEach(() => {
    localStorage.clear();
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
    mockApi();
    window.history.pushState({}, '', '/');
  });

  function renderAs(role: string) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['auth-me'], { id: 'u1', email: 'user@example.com', name: 'A User', role });
    return renderWithProviders(
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>,
    );
  }

  it("a citizen sees Home, About, and their full portal page list - never an officer/admin page", () => {
    renderAs('CITIZEN');
    // Two <header> elements exist on non-auth pages (ministry-header + sticky navbar);
    // nav links live in the last one.
    const headers = screen.getAllByRole('banner');
    const nav = within(headers[headers.length - 1]);
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
    const headers = screen.getAllByRole('banner');
    const nav = within(headers[headers.length - 1]);
    expect(nav.getByRole('link', { name: 'Assigned Requests' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Governance Alerts' })).toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'About' })).not.toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'My Parcels' })).not.toBeInTheDocument();
  });

  it("an admin sees their own portal page list only - no Home/About, no citizen/officer pages", () => {
    renderAs('ADMIN');
    const headers = screen.getAllByRole('banner');
    const nav = within(headers[headers.length - 1]);
    expect(nav.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Departments' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'System Monitoring' })).toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'Assigned Requests' })).not.toBeInTheDocument();
  });

  it('the navbar never shows the BhoomiSetu logo, for any role', () => {
    renderAs('ADMIN');
    const headers = screen.getAllByRole('banner');
    const nav = within(headers[headers.length - 1]);
    expect(nav.queryByAltText('BhoomiSetu Official Logo')).not.toBeInTheDocument();
  });
});

describe('App sign-out', () => {
  beforeEach(() => {
    localStorage.clear();
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
    mockApi();
    window.history.pushState({}, '', '/');
  });

  function renderAsGuest() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return renderWithProviders(
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>,
    );
  }

  it('shows Home/About/Features and Get Started, not the portal links or search tools', () => {
    renderAsGuest();

    const headers = screen.getAllByRole('banner');
    const nav = within(headers[headers.length - 1]);
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

    // The page has multiple header-role elements (utility bar + ministry header + nav header);
    // the primary nav links live in the last sticky <header class="navbar">.
    const headers = screen.getAllByRole('banner');
    const navHeader = headers[headers.length - 1];

    fireEvent.click(within(navHeader).getByRole('link', { name: 'About' }));
    expect(await screen.findByRole('heading', { name: 'About BhoomiSetu' })).toBeInTheDocument();

    fireEvent.click(within(navHeader).getByRole('link', { name: 'Features' }));
    expect(await screen.findByRole('heading', { name: 'What BhoomiSetu Does' })).toBeInTheDocument();
  });
});

describe('App auth pages get no main navbar (docs/FRONTEND_UPGRADE_SPEC.md §3)', () => {
  beforeEach(() => {
    localStorage.clear();
    mockApi();
  });

  function renderAt(path: string) {
    window.history.pushState({}, '', path);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return renderWithProviders(
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>,
    );
  }

  it('shows only a brand-only strip on /login, not Home/About/Features or Get Started', () => {
    renderAt('/login');
    const header = screen.getByRole('banner');
    // The auth strip shows a 'Return to Portal' back-link, not a logo img
    expect(within(header).getByRole('link', { name: /Return to Portal/i })).toBeInTheDocument();
    expect(within(header).queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
    expect(within(header).queryByRole('link', { name: 'About' })).not.toBeInTheDocument();
    expect(within(header).queryByRole('link', { name: 'Features' })).not.toBeInTheDocument();
    expect(within(header).queryByRole('link', { name: 'Get Started' })).not.toBeInTheDocument();
  });

  it('shows only a brand-only strip on /register too', () => {
    renderAt('/register');
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: /Return to Portal/i })).toBeInTheDocument();
    expect(within(header).queryByRole('link', { name: 'About' })).not.toBeInTheDocument();
  });

  it('the brand strip links back to the public Home page', () => {
    renderAt('/login');
    const returnLink = screen.getByRole('link', { name: /Return to Portal/i });
    expect(returnLink).toHaveAttribute('href', '/');
  });
});
