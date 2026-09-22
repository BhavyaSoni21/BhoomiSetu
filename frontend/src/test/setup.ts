import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { FALLBACK_STRINGS, SupportedLanguage } from '../context/LanguageContext';
const STORAGE_KEY = 'bhoomisetu_lang';

// Mock @tanstack/react-query to provide a QueryClient that auto-populates default data
// This ensures ANY QueryClient created in tests has the default cache populated
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  const { QueryClient: OriginalQueryClient, ...rest } = actual;

  const defaultQueries: Array<{ queryKey: unknown[]; data: unknown }> = [
    { queryKey: ['admin-users'], data: [] },
    { queryKey: ['users'], data: [] },
    { queryKey: ['admin-departments'], data: [] },
    { queryKey: ['officer-monitoring'], data: [] },
    { queryKey: ['officer-workflows', 'LAND_RECORDS'], data: [
      { id: 'wf-pending', parcelId: 'p1', workflowType: 'ROR_COPY_REQUEST', currentStatus: 'SUBMITTED', steps: [{ id: 's1', stepOrder: 1, department: 'LAND_RECORDS', assignedRole: 'LAND_RECORD_OFFICER', status: 'PENDING', action: null, remarks: null, completedAt: null }] },
      { id: 'wf-decided', parcelId: 'p2', workflowType: 'CORRECTION_REQUEST', currentStatus: 'IN_PROGRESS', steps: [{ id: 's4', stepOrder: 1, department: 'LAND_RECORDS', assignedRole: 'LAND_RECORD_OFFICER', status: 'APPROVED', action: 'APPROVE', remarks: null, completedAt: new Date().toISOString() }] },
    ] },
    { queryKey: ['parcels'], data: { parcels: [] } },
    { queryKey: ['my-parcels'], data: { parcels: [{ id: 'pa', canonicalParcelId: 'CAN-A', ulpin: 'ULPIN-A', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 500, geometry: '{}' }], total: 1 } },
    { queryKey: ['parcel-documents', ''], data: [] },
    { queryKey: ['field-evidence', ''], data: [] },
    { queryKey: ['workflow', ''], data: null },
    { queryKey: ['parcel-360-for-review', ''], data: null },
    { queryKey: ['notifications'], data: [] },
    { queryKey: ['governance-alerts'], data: { alerts: [] } },
    { queryKey: ['historical-imagery', ''], data: { images: [] } },
    { queryKey: ['change-detection', ''], data: { changes: [] } },
    { queryKey: ['change-detection-clusters'], data: [
      {
        clusterId: 'pune-cluster-1',
        stateCode: 'MH',
        district: 'Pune',
        type: 'city',
        bounds: { minLng: 73.8492, minLat: 18.5129, maxLng: 73.8642, maxLat: 18.5279 },
      },
    ]},
    { queryKey: ['analytics', 'top-risk'], data: { parcels: [] } },
    { queryKey: ['analytics', 'dashboard'], data: {} },
    { queryKey: ['map-layers'], data: [] },
    { queryKey: ['clusters'], data: [] },
    { queryKey: ['clusters-hierarchical'], data: {} },
    { queryKey: ['workflow-pipelines'], data: [] },
    { queryKey: ['governance-rules'], data: [] },
  ];

  class PatchedQueryClient extends OriginalQueryClient {
    constructor(config?: import('@tanstack/react-query').QueryClientConfig) {
      super(config);
      defaultQueries.forEach(({ queryKey, data }) => {
        this.setQueryData(queryKey, data);
      });
    }
  }

  return {
    ...rest,
    QueryClient: PatchedQueryClient,
  };
});

// Components call useTranslation() (LanguageContext.tsx) without every test
// wrapping in <LanguageProvider> - stub it the same way ResizeObserver/
// matchMedia are stubbed below, so useTranslation() works standalone and
// t(key) returns English fallback strings, resolving keys accurately.
// The mock respects the language from localStorage (set by LanguageProvider)
// so multi-language tests that wrap in <LanguageProvider> still get the
// correct language from FALLBACK_STRINGS.
function getLangFromStorage(): SupportedLanguage {
  const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  if (stored && FALLBACK_STRINGS[stored]) return stored as SupportedLanguage;
  return 'en';
}

vi.mock('../context/LanguageContext', async () => {
  const actual = await vi.importActual<typeof import('../context/LanguageContext')>('../context/LanguageContext');
  return {
    ...actual,
    useTranslation: () => {
      const lang = getLangFromStorage();
      const strings = FALLBACK_STRINGS[lang] || FALLBACK_STRINGS.en;
      return {
        t: (key: string, options?: Record<string, string | number> | string) => {
          let text = strings[key] ?? (typeof options === 'string' ? options : key);
          if (options && typeof options === 'object') {
            Object.entries(options).forEach(([k, v]) => {
              text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
            });
          }
          return text;
        },
        currentLang: lang,
        setLanguage: () => Promise.resolve(),
        loading: false,
        translationFailed: false,
      };
    },
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

// Capture original axios methods bound to the instance before any spying.
// vi.spyOn(obj, 'method') wraps the method but for axios instances the
// wrapper can disrupt the internal XHR/XHR-interceptor stack (especially
// with FormData), causing MSW-intercepted responses to never return.
// By providing an explicit mockImplementation that delegates to the bound
// original, the spy records calls AND the real axios request still completes.
const originalApiMethods = {
  get: apiService.get.bind(apiService),
  post: apiService.post.bind(apiService),
  put: apiService.put.bind(apiService),
  patch: apiService.patch.bind(apiService),
  delete: apiService.delete.bind(apiService),
};

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => {
  vi.spyOn(apiService, 'get').mockImplementation(originalApiMethods.get);
  vi.spyOn(apiService, 'post').mockImplementation((...args: any[]) => {
    // Workaround for axios + MSW + FormData + Content-Type:undefined in jsdom.
    // When Content-Type is explicitly set to undefined, MSW's XHR interceptor
    // fails to deliver the response back. Strip it so axios auto-detects FormData
    // and sets the proper multipart/form-data header with boundary.
    const config = args[2];
    if (config?.headers && config.headers['Content-Type'] === undefined) {
      const sanitizedConfig = { ...config, headers: { ...config.headers } };
      delete sanitizedConfig.headers['Content-Type'];
      return originalApiMethods.post(args[0], args[1], sanitizedConfig);
    }
    return originalApiMethods.post(args[0], args[1], args[2]);
  });
  vi.spyOn(apiService, 'put').mockImplementation(originalApiMethods.put);
  vi.spyOn(apiService, 'patch').mockImplementation(originalApiMethods.patch);
  vi.spyOn(apiService, 'delete').mockImplementation(originalApiMethods.delete);
});
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
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
        cacheTime: 0,
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
        cacheTime: 0,
      },
    },
  });
  // Replace the global testQueryClient's internal state
  Object.assign(testQueryClient, newClient);

  // MSW handlers are reset in afterEach automatically
};

// Export for use in tests
export { vi };
