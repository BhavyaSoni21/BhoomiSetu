import Dexie, { Table } from 'dexie';

// Local cache / workspace / queue — NOT source of truth (spec §1.2). PostGIS
// stays authoritative; every row carries freshness metadata and an owner so a
// shared field device never leaks one user's data to the next (spec §36/§37).

export interface CacheMeta {
  cachedAt: number;
  serverUpdatedAt?: string | null;
  version?: number;
}

export interface CachedParcel extends CacheMeta {
  id: string;                 // canonicalParcelId / parcel id
  ownerUserId: string;
  ulpin?: string | null;
  data: unknown;              // ParcelSummary payload
}

export interface CachedParcel360 extends CacheMeta {
  id: string;
  ownerUserId: string;
  data: unknown;              // Parcel360Response payload
}

export interface CachedCase extends CacheMeta {
  id: string;
  ownerUserId: string;
  parcelId?: string | null;
  data: unknown;
}

export type OpStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'CONFLICT' | 'CANCELLED';

export interface OfflineOperation {
  operationId: string;        // uuid — idempotency key (spec §7/§8)
  ownerUserId: string;
  entityType: 'case' | 'document' | 'evidence';
  entityId?: string | null;
  action: 'CREATE' | 'UPDATE';
  payload: unknown;
  parcelId?: string | null;
  clientVersion: number;
  status: OpStatus;
  attempts: number;
  lastError?: string | null;
  conflict?: unknown;         // server-returned conflict detail
  createdAt: number;
  updatedAt: number;
}

export interface CachedArea extends CacheMeta {
  id: string;                 // area key (cluster/district id)
  ownerUserId: string;
  label: string;
  bounds: [number, number, number, number];
  parcelIds: string[];
  estimatedBytes?: number;
}

export interface CachedTile {
  key: string;                // `${layer}/${z}/${x}/${y}`
  areaId: string;
  blob: Blob;
  cachedAt: number;
}

export interface SyncMetaRow {
  key: string;
  value: unknown;
}

class OfflineDB extends Dexie {
  parcels!: Table<CachedParcel, string>;
  parcel360!: Table<CachedParcel360, string>;
  cases!: Table<CachedCase, string>;
  operations!: Table<OfflineOperation, string>;
  areas!: Table<CachedArea, string>;
  tiles!: Table<CachedTile, string>;
  meta!: Table<SyncMetaRow, string>;

  constructor() {
    super('bhoomisetu-offline');
    this.version(1).stores({
      parcels: 'id, ownerUserId',
      parcel360: 'id, ownerUserId',
      cases: 'id, ownerUserId, parcelId',
      operations: 'operationId, ownerUserId, status',
      areas: 'id, ownerUserId',
      tiles: 'key, areaId',
      meta: 'key',
    });
  }
}

export const db = new OfflineDB();

// spec §37: on logout, drop this device's cached user data. We clear all
// user-scoped tables (single-user field device assumption); tiles/areas too.
export async function clearOfflineData(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()));
}
