import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';

// React Query v4 read-cache persistence to IndexedDB (spec §5). Only parcel /
// case / 360 reads survive a reload - auth, AI, and everything else stays
// in-memory so nothing sensitive is written to disk (spec §36).
const PERSIST_KEYS = ['parcels', 'parcel-360', 'parcel-summary', 'my-parcels', 'cases', 'case', 'parcel'];

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      cacheTime: 24 * 60 * 60_000, // survive long offline stretches
      retry: 1,
    },
  },
});

export const persister = createAsyncStoragePersister({
  storage: {
    getItem: (k) => get(k).then((v) => v ?? null),
    setItem: (k, v) => set(k, v),
    removeItem: (k) => del(k),
  },
  key: 'bhoomisetu-rq-cache',
});

export const persistOptions = {
  persister,
  maxAge: 24 * 60 * 60_000,
  dehydrateOptions: {
    shouldDehydrateQuery: (q: { queryKey: readonly unknown[] }) => {
      const head = Array.isArray(q.queryKey) ? q.queryKey[0] : q.queryKey;
      return typeof head === 'string' && PERSIST_KEYS.includes(head);
    },
  },
};
