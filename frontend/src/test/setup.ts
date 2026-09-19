import { vi, beforeAll, afterAll } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { FALLBACK_STRINGS } from '../context/LanguageContext';

// Mock @tanstack/react-query to provide a QueryClient that auto-populates default data
// This ensures ANY QueryClient created in tests has the default cache populated
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  const { QueryClient: OriginalQueryClient, ...rest } = actual;

  const defaultQueries: Array<{ queryKey: unknown[]; data: unknown }> = [
    { queryKey: ['admin-users'], data: [] },
    { queryKey: ['users'], data: [] },
    { queryKey: ['parcels'], data: { parcels: [] } },
    { queryKey: ['parcel-documents', ''], data: [] },
    { queryKey: ['field-evidence', ''], data: [] },
    { queryKey: ['workflow', ''], data: null },
    { queryKey: ['parcel-360-for-review', ''], data: null },
    { queryKey: ['notifications'], data: { notifications: [], unreadCount: 0 } },
    { queryKey: ['governance-alerts'], data: { alerts: [] } },
    { queryKey: ['historical-imagery', ''], data: { images: [] } },
    { queryKey: ['change-detection', ''], data: { changes: [] } },
    { queryKey: ['analytics', 'top-risk'], data: { parcels: [] } },
    { queryKey: ['analytics', 'dashboard'], data: {} },
    { queryKey: ['map-layers'], data: [] },
    { queryKey: ['clusters'], data: [] },
    { queryKey: ['clusters-hierarchical'], data: {} },
    { queryKey: ['workflow-pipelines'], data: [] },
    { queryKey: ['governance-rules'], data: [] },
  ];

  const PatchedQueryClient = function (...args: unknown[]) {
    const client = new OriginalQueryClient(...args);
    defaultQueries.forEach(({ queryKey, data }) => {
      client.setQueryData(queryKey, data);
    });
    return client;
  } as typeof OriginalQueryClient;

  return {
    ...rest,
    QueryClient: PatchedQueryClient,
  };
});

// Components call useTranslation() (LanguageContext.tsx) without every test
// wrapping in <LanguageProvider> - stub it the same way ResizeObserver/
// matchMedia are stubbed below, so useTranslation() works standalone and
// t(key) returns English fallback strings, resolving keys accurately.
vi.mock('../context/LanguageContext', async () => {
  const actual = await vi.importActual<typeof import('../context/LanguageContext')>('../context/LanguageContext');
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: Record<string, string | number> | string) => {
        let text = FALLBACK_STRINGS.en[key] ?? (typeof options === 'string' ? options : key);
        if (options && typeof options === 'object') {
          Object.entries(options).forEach(([k, v]) => {
            text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
          });
        }
        return text;
      },
      currentLang: 'en',
      setLanguage: () => Promise.resolve(),
      loading: false,
      translationFailed: false,
    }),
  };
});

// jsdom has no ResizeObserver (it does no real layout), but recharts'
// ResponsiveContainer requires one to exist at all just to mount - without
// this stub every chart-based component throws on render in tests.
class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub;

// jsdom also has no matchMedia - theme/theme.ts's system-preference check
// (and any future prefers-color-scheme code) needs this stubbed the same
// way, or mounting the app shell throws before a single test can run.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// URL.createObjectURL / revokeObjectURL for blob URLs in tests
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

import { server } from '../mocks/server';
import apiService from '../services/apiService';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => {
  vi.spyOn(apiService, 'get');
  vi.spyOn(apiService, 'post');
  vi.spyOn(apiService, 'put');
  vi.spyOn(apiService, 'patch');
  vi.spyOn(apiService, 'delete');
});
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

// Create a shared QueryClient with default query data for common queries
// This prevents useQuery from returning undefined and causing .map/.filter errors
// The QueryClient is patched via the mock above to auto-populate defaults
export const createTestQueryClient = () => {
  const { QueryClient } = require('@tanstack/react-query');
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return client;
};

// Global test QueryClient instance
export const testQueryClient = createTestQueryClient();

// Helper to reset all mocks and query cache between tests
export const resetTestState = () => {
  testQueryClient.clear();
  // Re-populate defaults (handled by PatchedQueryClient constructor)
  const { QueryClient } = require('@tanstack/react-query');
  const newClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  // Replace the global testQueryClient's internal state
  Object.assign(testQueryClient, newClient);

  // MSW handlers are reset in afterEach automatically
};

// Export for use in tests
export { vi };
