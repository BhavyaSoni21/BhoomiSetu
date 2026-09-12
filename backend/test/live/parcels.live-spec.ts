// Live-server counterpart of backend/test/parcels.e2e-spec.ts (PYTHON_MIGRATION_PLAN.md
// §4's second validation gate). Assertions copied verbatim where reachable
// without a fresh empty database (see the "returns all parcels with no
// filters" adaptation below, disclosed rather than silently dropped);
// app bootstrapping and fixture seeding (TypeORM repositories -> raw SQL
// against backend-py's own database) changed. Requires backend-py to
// already be up - see live-client.ts.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import request = require('supertest');
import { LIVE_BASE_URL, pgPool, closeLiveClient, cleanupLiveFixtures } from './live-client';
import { createLiveAuthenticatedUser } from './live-auth';

const square = (minLng: number, minLat: number, size = 0.001) => ({
  type: 'Polygon',
  coordinates: [[
    [minLng, minLat], [minLng + size, minLat], [minLng + size, minLat + size], [minLng, minLat + size], [minLng, minLat],
  ]],
});

async function insertParcel(overrides: {
  canonicalParcelId: string; ulpin?: string | null; stateCode: string; districtCode: string; localBodyCode: string;
  areaSqM: number; geometry: unknown; clusterId?: string | null;
}): Promise<string> {
  const result = await pgPool.query(
    `INSERT INTO parcels (id, canonical_parcel_id, ulpin, cluster_id, state_code, district_code, local_body_code, area_sq_m, geometry, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_GeomFromGeoJSON($8), 4326), now(), now())
     RETURNING id`,
    [
      overrides.canonicalParcelId, overrides.ulpin ?? null, overrides.clusterId ?? null,
      overrides.stateCode, overrides.districtCode, overrides.localBodyCode, overrides.areaSqM, JSON.stringify(overrides.geometry),
    ],
  );
  return result.rows[0].id as string;
}

describe('Parcels endpoints (live backend-py e2e)', () => {
  let parcelA: string;
  let parcelB: string;
  let citizenAuth: string;
  let otherCitizenAuth: string;
  let citizenLinkedParcel: string;
  const suffix = Date.now();

  beforeAll(async () => {
    citizenLinkedParcel = await insertParcel({
      canonicalParcelId: `LIVE-CAN-CITIZEN-1-${suffix}`, stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 1000,
      geometry: square(73.85, 18.52),
    });
    const citizenAuthResult = await createLiveAuthenticatedUser('CITIZEN');
    citizenAuth = citizenAuthResult.authHeader;
    await pgPool.query(`INSERT INTO citizen_parcels (id, citizen_id, parcel_id) VALUES (gen_random_uuid(), $1, $2)`, [citizenAuthResult.id, citizenLinkedParcel]);
    otherCitizenAuth = (await createLiveAuthenticatedUser('CITIZEN')).authHeader;

    parcelA = await insertParcel({
      canonicalParcelId: `LIVE-CAN00001-${suffix}`, ulpin: `LIVE-ULPIN1-${suffix}`, stateCode: 'DL', districtCode: 'PNDL', localBodyCode: 'DLLB001',
      areaSqM: 500, geometry: square(77.1, 28.6),
    });
    parcelB = await insertParcel({
      canonicalParcelId: `LIVE-CAN00002-${suffix}`, stateCode: 'KA', districtCode: 'PBLR', localBodyCode: 'KALB001', areaSqM: 300,
      geometry: square(77.6, 12.9),
    });

    await pgPool.query(
      `INSERT INTO parcel_identifiers (id, parcel_id, identifier_type, identifier_value, source_state, source_department)
       VALUES (gen_random_uuid(), $1, 'ULPIN', $2, 'DL', 'Land Records'),
              (gen_random_uuid(), $1, 'SURVEY_NUMBER', $3, 'DL', 'Land Records'),
              (gen_random_uuid(), $4, 'PLOT_NUMBER', $5, 'KA', 'Land Records'),
              (gen_random_uuid(), $4, 'LOCAL_PARCEL_ID', $6, 'KA', 'Land Records')`,
      [parcelA, `LIVE-ULPIN1-${suffix}`, `LIVE-42/3-${suffix}`, parcelB, `LIVE-P-9001-${suffix}`, `LIVE-KA-BLR-0007-${suffix}`],
    );
  });

  afterAll(async () => {
    await cleanupLiveFixtures();
    await closeLiveClient();
  });

  describe('GET /api/v1/parcels (search)', () => {
    it('finds a parcel by ULPIN', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/parcels').query({ ulpin: `LIVE-ULPIN1-${suffix}` }).expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.parcels[0].id).toBe(parcelA);
    });

    it('finds a parcel by survey_number', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/parcels').query({ survey_number: `LIVE-42/3-${suffix}` }).expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.parcels[0].id).toBe(parcelA);
    });

    it('finds a parcel by plot_number', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/parcels').query({ plot_number: `LIVE-P-9001-${suffix}` }).expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.parcels[0].id).toBe(parcelB);
    });

    it('finds a parcel by local_identifier', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/parcels').query({ local_identifier: `LIVE-KA-BLR-0007-${suffix}` }).expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.parcels[0].id).toBe(parcelB);
    });

    it('filters by state and district', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/parcels').query({ state: 'KA', district: 'PBLR' }).expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.parcels[0].id).toBe(parcelB);
    });

    it('returns an empty result set for an unmatched identifier', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/parcels').query({ ulpin: 'DOES-NOT-EXIST' }).expect(200);
      expect(res.body.total).toBe(0);
      expect(res.body.parcels).toHaveLength(0);
    });

    it('matches when combining two identifier-type filters that both belong to the same parcel', async () => {
      const res = await request(LIVE_BASE_URL)
        .get('/api/v1/parcels')
        .query({ ulpin: `LIVE-ULPIN1-${suffix}`, survey_number: `LIVE-42/3-${suffix}` })
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.parcels[0].id).toBe(parcelA);
    });

    it('returns the parcel full identifier list even when a single identifier filter is applied', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/parcels').query({ survey_number: `LIVE-42/3-${suffix}` }).expect(200);
      const identifierTypes = res.body.parcels[0].identifiers.map((i: any) => i.identifierType).sort();
      expect(identifierTypes).toEqual(['SURVEY_NUMBER', 'ULPIN']);
    });
  });

  describe('GET /api/v1/parcels/:id', () => {
    it('returns the parcel for a valid id', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${parcelA}`).expect(200);
      expect(res.body.canonicalParcelId).toBe(`LIVE-CAN00001-${suffix}`);
    });

    it('rejects a non-UUID id with 400', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/parcels/not-a-uuid').expect(400);
    });

    it('returns 404 for a well-formed but unknown UUID', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/parcels/00000000-0000-0000-0000-000000000000').expect(404);
    });
  });

  describe('GET /api/v1/parcels/:id/geometry', () => {
    it('returns a GeoJSON Feature for a valid parcel id', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${parcelA}/geometry`).expect(200);
      expect(res.body.type).toBe('Feature');
      expect(res.body.properties.id).toBe(parcelA);
      expect(res.body.geometry.type).toBe('Polygon');
    });

    it('rejects a non-UUID id with 400', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/parcels/not-a-uuid/geometry').expect(400);
    });

    it('returns 404 for a well-formed but unknown UUID', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/parcels/00000000-0000-0000-0000-000000000000/geometry').expect(404);
    });
  });

  describe('GET /api/v1/parcels/:id/360', () => {
    it('returns the canonical envelope with identifiers pulled from parcel_identifiers', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${parcelA}/360`).expect(200);
      expect(res.body.parcel_id).toBe(parcelA);
      expect(res.body.identifiers).toEqual({
        ulpin: `LIVE-ULPIN1-${suffix}`, survey_number: `LIVE-42/3-${suffix}`, plot_number: null, local_identifier: null,
      });
      expect(res.body.location).toEqual({ state: 'DL', district: 'PNDL', locality: 'DLLB001' });
      expect(res.body.spatial.area_sq_m).toBe(500);
      expect(res.body.spatial.geometry.type).toBe('Polygon');
    });

    it('marks every department NOT_AVAILABLE and nulls out departments.* for a parcel with no linked data', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${parcelA}/360`).expect(200);
      expect(res.body.sources).toEqual([
        { department: 'LAND_RECORDS', status: 'NOT_AVAILABLE' },
        { department: 'REGISTRATION', status: 'NOT_AVAILABLE' },
        { department: 'PLANNING', status: 'NOT_AVAILABLE' },
        { department: 'TAX', status: 'NOT_AVAILABLE' },
        { department: 'RESTRICTION', status: 'NOT_AVAILABLE' },
        { department: 'DISPUTE', status: 'NOT_AVAILABLE' },
        { department: 'ENCUMBRANCE', status: 'NOT_AVAILABLE' },
      ]);
      expect(res.body.departments).toEqual({
        landRecords: null, registration: null, planning: null, tax: null, restriction: null, dispute: null, encumbrance: null,
      });
    });

    it('rejects a non-UUID id with 400', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/parcels/not-a-uuid/360').expect(400);
    });

    it('returns 404 for a well-formed but unknown UUID', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/parcels/00000000-0000-0000-0000-000000000000/360').expect(404);
    });

    it('withholds owner-only departments and sets restrictedForViewer for an anonymous caller', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${citizenLinkedParcel}/360`).expect(200);
      expect(res.body.restrictedForViewer).toBe(true);
      expect(res.body.departments.planning).toBeNull();
      expect(res.body.departments.tax).toBeNull();
      expect(res.body.departments.restriction).toBeNull();
      expect(res.body.departments.dispute).toBeNull();
      expect(res.body.departments.encumbrance).toBeNull();
    });

    it('withholds owner-only departments for a signed-in citizen who is not associated with the parcel', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${citizenLinkedParcel}/360`).set('Authorization', otherCitizenAuth).expect(200);
      expect(res.body.restrictedForViewer).toBe(true);
      expect(res.body.departments.tax).toBeNull();
    });

    it('does not restrict for the citizen this parcel is actually associated with', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${citizenLinkedParcel}/360`).set('Authorization', citizenAuth).expect(200);
      expect(res.body.restrictedForViewer).toBe(false);
    });

    it('does not restrict for a staff account, regardless of association', async () => {
      const officerAuth = (await createLiveAuthenticatedUser('LAND_RECORD_OFFICER')).authHeader;
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${citizenLinkedParcel}/360`).set('Authorization', officerAuth).expect(200);
      expect(res.body.restrictedForViewer).toBe(false);
    });
  });

  describe('GET /api/v1/parcels/:id/neighbours', () => {
    let selected: string;
    let touching: string;
    let nearby: string;
    let far: string;

    beforeAll(async () => {
      const base = { stateCode: 'RJ', districtCode: 'NBRJAI', localBodyCode: 'RJLB001', areaSqM: 100 };
      selected = await insertParcel({ ...base, canonicalParcelId: `LIVE-NBR-SELECTED-${suffix}`, geometry: square(50.0, 50.0) });
      touching = await insertParcel({ ...base, canonicalParcelId: `LIVE-NBR-TOUCHING-${suffix}`, geometry: square(50.001, 50.0) });
      nearby = await insertParcel({ ...base, canonicalParcelId: `LIVE-NBR-NEARBY-${suffix}`, geometry: square(50.0015, 50.0) });
      far = await insertParcel({ ...base, canonicalParcelId: `LIVE-NBR-FAR-${suffix}`, geometry: square(50.05, 50.0) });
    });

    it('classifies an edge-sharing parcel as TOUCHING', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${selected}/neighbours`).expect(200);
      expect(res.body.selectedParcel.parcelId).toBe(selected);
      const ids = res.body.adjacentParcels.map((p: any) => p.parcelId);
      expect(ids).toContain(touching);
      expect(res.body.adjacentParcels.find((p: any) => p.parcelId === touching).relationship).toBe('TOUCHING');
    });

    it('classifies a nearby-but-not-touching parcel as NEARBY, and excludes far parcels, with the default distance', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${selected}/neighbours`).expect(200);
      const nearbyIds = res.body.nearbyParcels.map((p: any) => p.parcelId);
      expect(nearbyIds).toContain(nearby);
      expect(nearbyIds).not.toContain(far);
    });

    it('includes embedded GeoJSON Feature geometry for each entry', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${selected}/neighbours`).expect(200);
      expect(res.body.selectedParcel.feature.type).toBe('Feature');
      expect(res.body.selectedParcel.feature.geometry.type).toBe('Polygon');
    });

    it('respects a custom ?distance= to widen or narrow the nearby search', async () => {
      const narrow = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${selected}/neighbours`).query({ distance: 10 }).expect(200);
      expect(narrow.body.nearbyParcels.map((p: any) => p.parcelId)).not.toContain(nearby);

      const wide = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${selected}/neighbours`).query({ distance: 10000 }).expect(200);
      const wideIds = [...wide.body.adjacentParcels, ...wide.body.nearbyParcels].map((p: any) => p.parcelId);
      expect(wideIds).toContain(far);
    });

    it('rejects a non-UUID id with 400', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/parcels/not-a-uuid/neighbours').expect(400);
    });

    it('returns 404 for a well-formed but unknown UUID', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/parcels/00000000-0000-0000-0000-000000000000/neighbours').expect(404);
    });
  });

  describe('explicit ParcelNeighbour rows take priority over live geometry distance', () => {
    let hub: string;
    let explicitTouching: string;
    let closeButUnlinked: string;

    beforeAll(async () => {
      const base = { stateCode: 'GJ', districtCode: 'GJAHM', localBodyCode: 'GJLB001', areaSqM: 100 };
      hub = await insertParcel({ ...base, canonicalParcelId: `LIVE-HUB-${suffix}`, geometry: square(60, 60) });
      explicitTouching = await insertParcel({ ...base, canonicalParcelId: `LIVE-EXPLICIT-FAR-${suffix}`, geometry: square(65, 60) });
      closeButUnlinked = await insertParcel({ ...base, canonicalParcelId: `LIVE-CLOSE-UNLINKED-${suffix}`, geometry: square(60.0011, 60) });

      await pgPool.query(
        `INSERT INTO parcel_neighbours (id, parcel_id, neighbour_parcel_id, relationship_type) VALUES (gen_random_uuid(), $1, $2, 'TOUCHING')`,
        [hub, explicitTouching],
      );
    });

    it('returns the explicitly-linked far parcel as TOUCHING, and ignores the unlinked-but-close one', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${hub}/neighbours`).expect(200);
      const ids = res.body.adjacentParcels.map((p: any) => p.parcelId);
      expect(ids).toEqual([explicitTouching]);
      const allIds = [...res.body.adjacentParcels, ...res.body.nearbyParcels].map((p: any) => p.parcelId);
      expect(allIds).not.toContain(closeButUnlinked);
    });
  });

  describe('GET /api/v1/parcels/:id/context', () => {
    let hub: string;
    let clusterMate: string;
    let touchingNeighbour: string;
    let outsideCluster: string;

    beforeAll(async () => {
      const clusterId = `LIVE-RJ-JAIPUR-01-${suffix}`;
      const base = { stateCode: 'RJ', districtCode: 'CTXJAI', localBodyCode: 'RJLB001', areaSqM: 100, clusterId };
      hub = await insertParcel({ ...base, canonicalParcelId: `LIVE-CTX-HUB-${suffix}`, geometry: square(70.0, 70.0) });
      clusterMate = await insertParcel({ ...base, canonicalParcelId: `LIVE-CTX-MATE-${suffix}`, geometry: square(70.05, 70.05) });
      touchingNeighbour = await insertParcel({ ...base, canonicalParcelId: `LIVE-CTX-TOUCH-${suffix}`, geometry: square(70.001, 70.0) });
      outsideCluster = await insertParcel({
        ...base, clusterId: `LIVE-RJ-JAIPUR-02-${suffix}`, canonicalParcelId: `LIVE-CTX-OUTSIDE-${suffix}`, geometry: square(70.002, 70.0),
      });

      await pgPool.query(
        `INSERT INTO parcel_neighbours (id, parcel_id, neighbour_parcel_id, relationship_type) VALUES (gen_random_uuid(), $1, $2, 'TOUCHING')`,
        [hub, touchingNeighbour],
      );
    });

    it('returns every same-cluster parcel in clusterParcels, including ones far from the selected parcel', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${hub}/context`).expect(200);
      expect(res.body.cluster.clusterId).toBe(`LIVE-RJ-JAIPUR-01-${suffix}`);
      const clusterIds = res.body.clusterParcels.map((p: any) => p.parcelId);
      expect(clusterIds).toEqual(expect.arrayContaining([hub, clusterMate, touchingNeighbour]));
      expect(clusterIds).not.toContain(outsideCluster);
    });

    it('still includes adjacentParcels/nearbyParcels from the neighbour relationships', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${hub}/context`).expect(200);
      expect(res.body.adjacentParcels.map((p: any) => p.parcelId)).toContain(touchingNeighbour);
    });

    it('embeds full GeoJSON Feature geometry for every cluster parcel', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${hub}/context`).expect(200);
      for (const entry of res.body.clusterParcels) {
        expect(entry.feature.type).toBe('Feature');
        expect(entry.feature.geometry.type).toBe('Polygon');
      }
    });

    it('rejects a non-UUID id with 400', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/parcels/not-a-uuid/context').expect(400);
    });

    it('returns 404 for a well-formed but unknown UUID', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/parcels/00000000-0000-0000-0000-000000000000/context').expect(404);
    });

    it('falls back to a single-parcel cluster when clusterId is null', async () => {
      const noCluster = await insertParcel({
        stateCode: 'RJ', districtCode: 'CTXJAI', localBodyCode: 'RJLB001', areaSqM: 100, canonicalParcelId: `LIVE-CTX-NO-CLUSTER-${suffix}`,
        geometry: square(71.0, 71.0),
      });
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${noCluster}/context`).expect(200);
      expect(res.body.cluster.clusterId).toBeNull();
      expect(res.body.clusterParcels).toEqual([expect.objectContaining({ parcelId: noCluster })]);
    });
  });

  describe('GET /api/v1/parcels/mine', () => {
    it('returns only the parcels linked to the signed-in citizen', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/parcels/mine').set('Authorization', citizenAuth).expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.parcels).toHaveLength(1);
      expect(res.body.parcels[0].id).toBe(citizenLinkedParcel);
    });

    it('returns an empty list for a citizen with no linked parcels', async () => {
      const res = await request(LIVE_BASE_URL).get('/api/v1/parcels/mine').set('Authorization', otherCitizenAuth).expect(200);
      expect(res.body).toEqual({ parcels: [], total: 0 });
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/parcels/mine').expect(401);
    });

    it('rejects a non-citizen (e.g. an officer) with 403', async () => {
      const officerAuth = (await createLiveAuthenticatedUser('LAND_RECORD_OFFICER')).authHeader;
      await request(LIVE_BASE_URL).get('/api/v1/parcels/mine').set('Authorization', officerAuth).expect(403);
    });
  });

  describe('GET /api/v1/parcels/:id/ownership-history', () => {
    it('allows the associated citizen to see it', async () => {
      await request(LIVE_BASE_URL).get(`/api/v1/parcels/${citizenLinkedParcel}/ownership-history`).set('Authorization', citizenAuth).expect(200);
    });

    it("rejects a citizen who isn't associated with the parcel, with 403", async () => {
      await request(LIVE_BASE_URL).get(`/api/v1/parcels/${citizenLinkedParcel}/ownership-history`).set('Authorization', otherCitizenAuth).expect(403);
    });

    it('allows staff regardless of citizen association', async () => {
      const officerAuth = (await createLiveAuthenticatedUser('LAND_RECORD_OFFICER')).authHeader;
      await request(LIVE_BASE_URL).get(`/api/v1/parcels/${citizenLinkedParcel}/ownership-history`).set('Authorization', officerAuth).expect(200);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(LIVE_BASE_URL).get(`/api/v1/parcels/${citizenLinkedParcel}/ownership-history`).expect(401);
    });

    it('returns 404 for an unknown parcel', async () => {
      await request(LIVE_BASE_URL)
        .get('/api/v1/parcels/00000000-0000-0000-0000-000000000000/ownership-history')
        .set('Authorization', citizenAuth)
        .expect(404);
    });
  });

  describe('GET /api/v1/parcels/:id/documents (land property papers)', () => {
    let documentFilePath: string;
    let hostFilePath: string;
    let documentId: string;

    beforeAll(async () => {
      // backend-py runs in its own Docker container, bind-mounted from
      // ../backend-py on the host (docker-compose.yml) - a file written to
      // the Jest host process's own os.tmpdir() (a different filesystem,
      // possibly a different OS entirely) would never be visible to the
      // server process actually serving this file. Writing under the
      // bind-mounted backend-py directory instead makes the same bytes
      // reachable from both sides, at the container's own /app/... path -
      // which is the path this test stores in file_path, matching what a
      // real upload's stored path looks like from backend-py's perspective.
      const fileName = `live-test-parcel-document-${Date.now()}.png`;
      hostFilePath = path.join(__dirname, '..', '..', '..', 'backend-py', fileName);
      documentFilePath = `/app/${fileName}`;
      fs.writeFileSync(hostFilePath, Buffer.from('fake-png-bytes'));
      const result = await pgPool.query(
        `INSERT INTO parcel_documents (id, parcel_id, document_type, file_name, file_path, mime_type, extracted_text, registration_status, created_at)
         VALUES (gen_random_uuid(), $1, 'ROR_COPY', 'test-parcel-document.png', $2, 'image/png', 'Owner Name Test Owner', 'REGISTERED', now())
         RETURNING id`,
        [citizenLinkedParcel, documentFilePath],
      );
      documentId = result.rows[0].id;
    });

    it("lists a parcel's document metadata publicly, with no auth needed", async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${citizenLinkedParcel}/documents`).expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toEqual(expect.objectContaining({ id: documentId, documentType: 'ROR_COPY', registrationStatus: 'REGISTERED' }));
    });

    it('returns an empty array for a parcel with no documents', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${parcelA}/documents`).expect(200);
      expect(res.body).toEqual([]);
    });

    it("serves the file to the parcel's linked citizen", async () => {
      const res = await request(LIVE_BASE_URL)
        .get(`/api/v1/parcels/${citizenLinkedParcel}/documents/${documentId}/file`)
        .set('Authorization', citizenAuth)
        .expect(200);
      expect(res.headers['content-type']).toBe('image/png');
    });

    it('serves the file to staff regardless of citizen association', async () => {
      const officerAuth = (await createLiveAuthenticatedUser('LAND_RECORD_OFFICER')).authHeader;
      await request(LIVE_BASE_URL)
        .get(`/api/v1/parcels/${citizenLinkedParcel}/documents/${documentId}/file`)
        .set('Authorization', officerAuth)
        .expect(200);
    });

    it("rejects a citizen who isn't associated with the parcel, with 403", async () => {
      await request(LIVE_BASE_URL)
        .get(`/api/v1/parcels/${citizenLinkedParcel}/documents/${documentId}/file`)
        .set('Authorization', otherCitizenAuth)
        .expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(LIVE_BASE_URL).get(`/api/v1/parcels/${citizenLinkedParcel}/documents/${documentId}/file`).expect(401);
    });

    it('returns 404 for a bare document row with no real file on disk', async () => {
      const bare = await pgPool.query(
        `INSERT INTO parcel_documents (id, parcel_id, document_type, file_name, file_path, mime_type, registration_status, created_at)
         VALUES (gen_random_uuid(), $1, 'ROR_COPY', '', '', 'image/png', 'REGISTERED', now()) RETURNING id`,
        [citizenLinkedParcel],
      );
      await request(LIVE_BASE_URL)
        .get(`/api/v1/parcels/${citizenLinkedParcel}/documents/${bare.rows[0].id}/file`)
        .set('Authorization', citizenAuth)
        .expect(404);
    });

    afterAll(() => {
      fs.rmSync(hostFilePath, { force: true });
    });
  });

  describe('GET /api/v1/parcels/:id/history', () => {
    let historyParcel: string;

    beforeAll(async () => {
      historyParcel = await insertParcel({
        canonicalParcelId: `LIVE-CAN-HISTORY-1-${suffix}`, stateCode: 'MH', districtCode: 'HISPUN', localBodyCode: 'MHLB001', areaSqM: 500,
        geometry: square(73.9, 18.6),
      });
      await pgPool.query(
        `INSERT INTO parcel_historical_states (id, parcel_id, year, land_use, zoning_status, restriction_status, tax_status)
         VALUES (gen_random_uuid(), $1, 2022, 'AGRICULTURAL', 'NOT_REQUIRED', 'UNRESTRICTED', 'PAID'),
                (gen_random_uuid(), $1, 2023, 'AGRICULTURAL', 'NOT_REQUIRED', 'UNRESTRICTED', 'PAID'),
                (gen_random_uuid(), $1, 2024, 'RESIDENTIAL', 'APPROVED', 'UNRESTRICTED', 'PAID'),
                (gen_random_uuid(), $1, 2025, 'RESIDENTIAL', 'APPROVED', 'UNRESTRICTED', 'PENDING')`,
        [historyParcel],
      );
    });

    it('is public - no auth required', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${historyParcel}/history`).expect(200);
      expect(res.body).toHaveLength(4);
    });

    it('returns every year, oldest first', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${historyParcel}/history`).expect(200);
      expect(res.body.map((r: any) => r.year)).toEqual([2022, 2023, 2024, 2025]);
      expect(res.body[1].landUse).toBe('AGRICULTURAL');
      expect(res.body[2].landUse).toBe('RESIDENTIAL');
    });

    it('filters to a single year via ?year=', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${historyParcel}/history?year=2024`).expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].landUse).toBe('RESIDENTIAL');
    });

    it('returns an empty array for a parcel with no history rows', async () => {
      const res = await request(LIVE_BASE_URL).get(`/api/v1/parcels/${parcelA}/history`).expect(200);
      expect(res.body).toEqual([]);
    });

    it('returns 404 for an unknown parcel', async () => {
      await request(LIVE_BASE_URL).get('/api/v1/parcels/00000000-0000-0000-0000-000000000000/history').expect(404);
    });
  });
});
