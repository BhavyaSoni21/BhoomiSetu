process.env.USE_SQLITE = 'true';
process.env.SQLITE_PATH = ':memory:';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { Parcel } from '../src/parcels/parcel.entity';
import { ParcelIdentifier } from '../src/parcels/parcel-identifier.entity';
import { ParcelNeighbour } from '../src/parcels/parcel-neighbour.entity';

describe('Parcels endpoints (e2e)', () => {
  let app: INestApplication;
  let parcelRepository: Repository<Parcel>;
  let identifierRepository: Repository<ParcelIdentifier>;
  let neighbourRepository: Repository<ParcelNeighbour>;
  let parcelA: Parcel;
  let parcelB: Parcel;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    parcelRepository = moduleFixture.get(getRepositoryToken(Parcel));
    identifierRepository = moduleFixture.get(getRepositoryToken(ParcelIdentifier));
    neighbourRepository = moduleFixture.get(getRepositoryToken(ParcelNeighbour));

    parcelA = await parcelRepository.save({
      canonicalParcelId: 'CAN00001',
      ulpin: 'ULPIN0000000001',
      stateCode: 'DL',
      districtCode: 'NDL',
      localBodyCode: 'DLLB001',
      geometry: JSON.stringify({
        type: 'Polygon',
        coordinates: [[[77.1, 28.6], [77.11, 28.6], [77.11, 28.61], [77.1, 28.61], [77.1, 28.6]]],
      }),
      areaSqM: 500,
    });

    parcelB = await parcelRepository.save({
      canonicalParcelId: 'CAN00002',
      ulpin: null,
      stateCode: 'KA',
      districtCode: 'BLR',
      localBodyCode: 'KALB001',
      geometry: JSON.stringify({
        type: 'Polygon',
        coordinates: [[[77.6, 12.9], [77.61, 12.9], [77.61, 12.91], [77.6, 12.91], [77.6, 12.9]]],
      }),
      areaSqM: 300,
    });

    await identifierRepository.save([
      {
        parcel: parcelA,
        identifierType: 'ULPIN',
        identifierValue: 'ULPIN0000000001',
        sourceState: 'DL',
        sourceDepartment: 'Land Records',
      },
      {
        parcel: parcelA,
        identifierType: 'SURVEY_NUMBER',
        identifierValue: '42/3',
        sourceState: 'DL',
        sourceDepartment: 'Land Records',
      },
      {
        parcel: parcelB,
        identifierType: 'PLOT_NUMBER',
        identifierValue: 'P-9001',
        sourceState: 'KA',
        sourceDepartment: 'Land Records',
      },
      {
        parcel: parcelB,
        identifierType: 'LOCAL_PARCEL_ID',
        identifierValue: 'KA-BLR-0007',
        sourceState: 'KA',
        sourceDepartment: 'Land Records',
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/parcels (search)', () => {
    it('returns all parcels with no filters', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/parcels').expect(200);
      expect(res.body.total).toBe(2);
    });

    it('finds a parcel by ULPIN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/parcels')
        .query({ ulpin: 'ULPIN0000000001' })
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.parcels[0].id).toBe(parcelA.id);
    });

    it('finds a parcel by survey_number', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/parcels')
        .query({ survey_number: '42/3' })
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.parcels[0].id).toBe(parcelA.id);
    });

    it('finds a parcel by plot_number', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/parcels')
        .query({ plot_number: 'P-9001' })
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.parcels[0].id).toBe(parcelB.id);
    });

    it('finds a parcel by local_identifier', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/parcels')
        .query({ local_identifier: 'KA-BLR-0007' })
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.parcels[0].id).toBe(parcelB.id);
    });

    it('filters by state and district', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/parcels')
        .query({ state: 'KA', district: 'BLR' })
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.parcels[0].id).toBe(parcelB.id);
    });

    it('returns an empty result set for an unmatched identifier', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/parcels')
        .query({ ulpin: 'DOES-NOT-EXIST' })
        .expect(200);
      expect(res.body.total).toBe(0);
      expect(res.body.parcels).toHaveLength(0);
    });

    it('matches when combining two identifier-type filters that both belong to the same parcel', async () => {
      // parcelA has both a ULPIN and a SURVEY_NUMBER identifier (different rows) -
      // combining both filters must still find it, not require one joined row to match both.
      const res = await request(app.getHttpServer())
        .get('/api/v1/parcels')
        .query({ ulpin: 'ULPIN0000000001', survey_number: '42/3' })
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.parcels[0].id).toBe(parcelA.id);
    });

    it('returns the parcel full identifier list even when a single identifier filter is applied', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/parcels')
        .query({ survey_number: '42/3' })
        .expect(200);
      const identifierTypes = res.body.parcels[0].identifiers.map((i: any) => i.identifierType).sort();
      expect(identifierTypes).toEqual(['SURVEY_NUMBER', 'ULPIN']);
    });
  });

  describe('GET /api/v1/parcels/:id', () => {
    it('returns the parcel for a valid id', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/parcels/${parcelA.id}`).expect(200);
      expect(res.body.canonicalParcelId).toBe('CAN00001');
    });

    it('rejects a non-UUID id with 400', async () => {
      await request(app.getHttpServer()).get('/api/v1/parcels/not-a-uuid').expect(400);
    });
  });

  describe('GET /api/v1/parcels/:id/geometry', () => {
    it('returns a GeoJSON Feature for a valid parcel id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/parcels/${parcelA.id}/geometry`)
        .expect(200);
      expect(res.body.type).toBe('Feature');
      expect(res.body.properties.id).toBe(parcelA.id);
      expect(res.body.geometry.type).toBe('Polygon');
    });

    it('rejects a non-UUID id with 400', async () => {
      await request(app.getHttpServer()).get('/api/v1/parcels/not-a-uuid/geometry').expect(400);
    });

    it('returns 404 for a well-formed but unknown UUID', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/parcels/00000000-0000-0000-0000-000000000000/geometry')
        .expect(404);
    });
  });

  describe('GET /api/v1/parcels/:id/360', () => {
    // Phase 5 replaced the {parcel, departments} stub with the Tech.md #15
    // canonical envelope (parcel_id/identifiers/location/spatial/sources)
    // plus real aggregated department data - see interoperability.e2e-spec.ts
    // for full adapter/aggregator coverage. This just checks the shape and
    // the "no data available" (unlinked department) path using parcelA,
    // which has no Registration/Planning/Tax/Restriction/State-schema rows.
    it('returns the canonical envelope with identifiers pulled from parcel_identifiers', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/parcels/${parcelA.id}/360`).expect(200);
      expect(res.body.parcel_id).toBe(parcelA.id);
      expect(res.body.identifiers).toEqual({
        ulpin: 'ULPIN0000000001',
        survey_number: '42/3',
        plot_number: null,
        local_identifier: null,
      });
      expect(res.body.location).toEqual({ state: 'DL', district: 'NDL', locality: 'DLLB001' });
      expect(res.body.spatial.area_sq_m).toBe(500);
      expect(res.body.spatial.geometry.type).toBe('Polygon');
    });

    it('marks every department NOT_AVAILABLE and nulls out departments.* for a parcel with no linked data', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/parcels/${parcelA.id}/360`).expect(200);
      expect(res.body.sources).toEqual([
        { department: 'LAND_RECORDS', status: 'NOT_AVAILABLE' },
        { department: 'REGISTRATION', status: 'NOT_AVAILABLE' },
        { department: 'PLANNING', status: 'NOT_AVAILABLE' },
        { department: 'TAX', status: 'NOT_AVAILABLE' },
        { department: 'RESTRICTION', status: 'NOT_AVAILABLE' },
        { department: 'DISPUTE', status: 'NOT_AVAILABLE' },
      ]);
      expect(res.body.departments).toEqual({
        landRecords: null, registration: null, planning: null, tax: null, restriction: null, dispute: null,
      });
    });

    it('rejects a non-UUID id with 400', async () => {
      await request(app.getHttpServer()).get('/api/v1/parcels/not-a-uuid/360').expect(400);
    });

    it('returns 404 for a well-formed but unknown UUID', async () => {
      await request(app.getHttpServer()).get('/api/v1/parcels/00000000-0000-0000-0000-000000000000/360').expect(404);
    });
  });

  describe('GET /api/v1/parcels/:id/neighbours', () => {
    // Small, tightly-controlled squares (not the large fixtures above) so
    // touching/nearby/far distances are exact and predictable.
    let selected: Parcel;
    let touching: Parcel;
    let nearby: Parcel;
    let far: Parcel;

    const square = (minLng: number, minLat: number, size = 0.001) =>
      JSON.stringify({
        type: 'Polygon',
        coordinates: [[
          [minLng, minLat],
          [minLng + size, minLat],
          [minLng + size, minLat + size],
          [minLng, minLat + size],
          [minLng, minLat],
        ]],
      });

    beforeAll(async () => {
      const base = { stateCode: 'RJ', districtCode: 'JAI', localBodyCode: 'RJLB001', areaSqM: 100 };
      selected = await parcelRepository.save({ ...base, canonicalParcelId: 'NBR-SELECTED', geometry: square(10.0, 10.0) });
      // Shares the right edge of `selected` exactly -> distance 0 (TOUCHING).
      touching = await parcelRepository.save({ ...base, canonicalParcelId: 'NBR-TOUCHING', geometry: square(10.001, 10.0) });
      // ~55m gap from `selected`'s right edge -> within the 200m default (NEARBY).
      nearby = await parcelRepository.save({ ...base, canonicalParcelId: 'NBR-NEARBY', geometry: square(10.0015, 10.0) });
      // ~5km away -> excluded even at a generous distance.
      far = await parcelRepository.save({ ...base, canonicalParcelId: 'NBR-FAR', geometry: square(10.05, 10.0) });
    });

    it('classifies an edge-sharing parcel as TOUCHING', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/parcels/${selected.id}/neighbours`).expect(200);
      expect(res.body.selectedParcel.parcelId).toBe(selected.id);
      const ids = res.body.adjacentParcels.map((p: any) => p.parcelId);
      expect(ids).toContain(touching.id);
      expect(res.body.adjacentParcels.find((p: any) => p.parcelId === touching.id).relationship).toBe('TOUCHING');
    });

    it('classifies a nearby-but-not-touching parcel as NEARBY, and excludes far parcels, with the default distance', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/parcels/${selected.id}/neighbours`).expect(200);
      const nearbyIds = res.body.nearbyParcels.map((p: any) => p.parcelId);
      expect(nearbyIds).toContain(nearby.id);
      expect(nearbyIds).not.toContain(far.id);
      const allIds = [...res.body.adjacentParcels, ...res.body.nearbyParcels].map((p: any) => p.parcelId);
      expect(allIds).not.toContain(far.id);
    });

    it('includes embedded GeoJSON Feature geometry for each entry', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/parcels/${selected.id}/neighbours`).expect(200);
      expect(res.body.selectedParcel.feature.type).toBe('Feature');
      expect(res.body.selectedParcel.feature.geometry.type).toBe('Polygon');
      expect(res.body.nearbyParcels[0].feature.type).toBe('Feature');
    });

    it('respects a custom ?distance= to widen or narrow the nearby search', async () => {
      const narrow = await request(app.getHttpServer())
        .get(`/api/v1/parcels/${selected.id}/neighbours`)
        .query({ distance: 10 })
        .expect(200);
      expect(narrow.body.nearbyParcels.map((p: any) => p.parcelId)).not.toContain(nearby.id);

      const wide = await request(app.getHttpServer())
        .get(`/api/v1/parcels/${selected.id}/neighbours`)
        .query({ distance: 10000 })
        .expect(200);
      const wideIds = [...wide.body.adjacentParcels, ...wide.body.nearbyParcels].map((p: any) => p.parcelId);
      expect(wideIds).toContain(far.id);
    });

    it('rejects a non-UUID id with 400', async () => {
      await request(app.getHttpServer()).get('/api/v1/parcels/not-a-uuid/neighbours').expect(400);
    });

    it('returns 404 for a well-formed but unknown UUID', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/parcels/00000000-0000-0000-0000-000000000000/neighbours')
        .expect(404);
    });
  });

  describe('explicit ParcelNeighbour rows take priority over live geometry distance', () => {
    // Two parcels that are geometrically far apart (would never classify as
    // TOUCHING/NEARBY by distance) but explicitly linked as TOUCHING, plus a
    // geometrically-close third parcel with NO row - proving the precomputed
    // relationship, not proximity, drives the result once rows exist.
    let hub: Parcel;
    let explicitTouching: Parcel;
    let closeButUnlinked: Parcel;

    const farSquare = (offset: number) =>
      JSON.stringify({
        type: 'Polygon',
        coordinates: [[
          [20 + offset, 20], [20.001 + offset, 20], [20.001 + offset, 20.001], [20 + offset, 20.001], [20 + offset, 20],
        ]],
      });

    beforeAll(async () => {
      const base = { stateCode: 'GJ', districtCode: 'AHM', localBodyCode: 'GJLB001', areaSqM: 100 };
      hub = await parcelRepository.save({ ...base, canonicalParcelId: 'HUB', geometry: farSquare(0) });
      explicitTouching = await parcelRepository.save({ ...base, canonicalParcelId: 'EXPLICIT-FAR', geometry: farSquare(5) }); // ~500km away
      closeButUnlinked = await parcelRepository.save({ ...base, canonicalParcelId: 'CLOSE-UNLINKED', geometry: farSquare(0.0011) }); // touching distance

      await neighbourRepository.save({ parcelId: hub.id, neighbourParcelId: explicitTouching.id, relationshipType: 'TOUCHING' });
    });

    it('returns the explicitly-linked far parcel as TOUCHING, and ignores the unlinked-but-close one', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/parcels/${hub.id}/neighbours`).expect(200);
      const ids = res.body.adjacentParcels.map((p: any) => p.parcelId);
      expect(ids).toEqual([explicitTouching.id]);
      const allIds = [...res.body.adjacentParcels, ...res.body.nearbyParcels].map((p: any) => p.parcelId);
      expect(allIds).not.toContain(closeButUnlinked.id);
    });
  });

  describe('GET /api/v1/parcels/:id/context', () => {
    let hub: Parcel;
    let clusterMate: Parcel;
    let touchingNeighbour: Parcel;
    let outsideCluster: Parcel;

    const square = (minLng: number, minLat: number, size = 0.001) =>
      JSON.stringify({
        type: 'Polygon',
        coordinates: [[
          [minLng, minLat], [minLng + size, minLat], [minLng + size, minLat + size], [minLng, minLat + size], [minLng, minLat],
        ]],
      });

    beforeAll(async () => {
      const base = { stateCode: 'RJ', districtCode: 'JAI', localBodyCode: 'RJLB001', areaSqM: 100, clusterId: 'RJ-JAIPUR-01' };
      hub = await parcelRepository.save({ ...base, canonicalParcelId: 'CTX-HUB', geometry: square(30.0, 30.0) });
      clusterMate = await parcelRepository.save({ ...base, canonicalParcelId: 'CTX-MATE', geometry: square(30.05, 30.05) }); // same cluster, far away in this cluster
      touchingNeighbour = await parcelRepository.save({ ...base, canonicalParcelId: 'CTX-TOUCH', geometry: square(30.001, 30.0) });
      outsideCluster = await parcelRepository.save({
        ...base,
        clusterId: 'RJ-JAIPUR-02',
        canonicalParcelId: 'CTX-OUTSIDE',
        geometry: square(30.002, 30.0),
      });

      await neighbourRepository.save({ parcelId: hub.id, neighbourParcelId: touchingNeighbour.id, relationshipType: 'TOUCHING' });
    });

    it('returns every same-cluster parcel in clusterParcels, including ones far from the selected parcel', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/parcels/${hub.id}/context`).expect(200);
      expect(res.body.cluster.clusterId).toBe('RJ-JAIPUR-01');
      const clusterIds = res.body.clusterParcels.map((p: any) => p.parcelId);
      expect(clusterIds).toEqual(expect.arrayContaining([hub.id, clusterMate.id, touchingNeighbour.id]));
      expect(clusterIds).not.toContain(outsideCluster.id);
    });

    it('still includes adjacentParcels/nearbyParcels from the neighbour relationships', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/parcels/${hub.id}/context`).expect(200);
      expect(res.body.adjacentParcels.map((p: any) => p.parcelId)).toContain(touchingNeighbour.id);
    });

    it('embeds full GeoJSON Feature geometry for every cluster parcel', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/parcels/${hub.id}/context`).expect(200);
      for (const entry of res.body.clusterParcels) {
        expect(entry.feature.type).toBe('Feature');
        expect(entry.feature.geometry.type).toBe('Polygon');
      }
    });

    it('rejects a non-UUID id with 400', async () => {
      await request(app.getHttpServer()).get('/api/v1/parcels/not-a-uuid/context').expect(400);
    });

    it('returns 404 for a well-formed but unknown UUID', async () => {
      await request(app.getHttpServer()).get('/api/v1/parcels/00000000-0000-0000-0000-000000000000/context').expect(404);
    });

    it('falls back to a single-parcel cluster when clusterId is null', async () => {
      const noCluster = await parcelRepository.save({
        stateCode: 'RJ',
        districtCode: 'JAI',
        localBodyCode: 'RJLB001',
        areaSqM: 100,
        canonicalParcelId: 'CTX-NO-CLUSTER',
        geometry: square(31.0, 31.0),
      });
      const res = await request(app.getHttpServer()).get(`/api/v1/parcels/${noCluster.id}/context`).expect(200);
      expect(res.body.cluster.clusterId).toBeNull();
      expect(res.body.clusterParcels).toEqual([
        expect.objectContaining({ parcelId: noCluster.id }),
      ]);
    });
  });
});
