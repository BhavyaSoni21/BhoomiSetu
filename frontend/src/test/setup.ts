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

// Global apiService mock with default responses for common queries
// This prevents "evidence.map is not a function" / "users.filter is not a function"
// errors when useQuery returns undefined data in tests.
vi.mock('../services/apiService', () => {
  const mockGet = vi.fn();
  const mockPatch = vi.fn();
  const mockPost = vi.fn();
  const mockDelete = vi.fn();
  const mockPut = vi.fn();

  // Default responses for common endpoints
  const defaultResponses: Record<string, unknown> = {
    '/users': { data: [] },
    '/admin/users': { data: [] },
    '/parcels': { data: { parcels: [] } },
  };

  mockGet.mockImplementation(async (url: string) => {
    // Return default response for known endpoints, or empty array for unknown
    if (defaultResponses[url]) {
      return defaultResponses[url];
    }
    // For dynamic endpoints, return empty data by default
    return { data: [] };
  });

  mockPatch.mockResolvedValue({ data: {} });
  mockPost.mockResolvedValue({ data: {} });
  mockDelete.mockResolvedValue({ data: {} });
  mockPut.mockResolvedValue({ data: {} });

  return {
    default: {
      get: mockGet,
      patch: mockPatch,
      post: mockPost,
      delete: mockDelete,
      put: mockPut,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    },
  };
});

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

  // Reset apiService mocks
  // Note: apiService is mocked globally above, so we reset the mocked functions directly
  // The mocked functions are accessible via the vi.mocked() calls in individual tests
};

// Export for use in tests
export { vi };
