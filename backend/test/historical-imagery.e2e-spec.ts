process.env.USE_SQLITE = 'true';
process.env.SQLITE_PATH = ':memory:';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import request = require('supertest');
import sharp from 'sharp';
import { AppModule } from '../src/app.module';
import { Parcel } from '../src/parcels/parcel.entity';
import { ParcelHistoricalState } from '../src/parcels/parcel-historical-state.entity';
import { DisputeRecord } from '../src/departments/dispute-record.entity';
import { RestrictionRecord } from '../src/departments/restriction-record.entity';
import { GovernanceAlert } from '../src/governance/governance-alert.entity';
import { ClusterHistoricalSnapshot } from '../src/historical-imagery/cluster-historical-snapshot.entity';
import { NarrativeService } from '../src/historical-imagery/narrative.service';
import { CURRENT_YEAR } from '../src/common/parcel-generation/parcel-category';
import { createAuthenticatedUser } from './helpers/auth';

async function makeFlatImage(): Promise<Buffer> {
  const size = 64;
  const buf = Buffer.alloc(size * size * 4, 0);
  for (let i = 0; i < size * size; i++) {
    buf[i * 4] = 143;
    buf[i * 4 + 1] = 174;
    buf[i * 4 + 2] = 134;
    buf[i * 4 + 3] = 255;
  }
  return sharp(buf, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
}

const square = (minLng: number, minLat: number, size = 0.0006) =>
  JSON.stringify({
    type: 'Polygon',
    coordinates: [[
      [minLng, minLat], [minLng + size, minLat], [minLng + size, minLat + size], [minLng, minLat + size], [minLng, minLat],
    ]],
  });

const OLD_YEAR = 2022;
// Comparisons that generate governance alerts are now restricted to exactly
// CURRENT_YEAR-1 -> CURRENT_YEAR (docs/ADMIN_PANEL_ISSUES.md follow-up, per
// the user's explicit "I want the governance alerts based on the 2025-2026
// differences only") - PREVIOUS_YEAR is the only "from" value compare()
// accepts any more; OLD_YEAR stays purely for the unrestricted browse
// endpoints (GET .../years/:year/image, GET .../years/:year/parcels).
const PREVIOUS_YEAR = CURRENT_YEAR - 1;
const CLUSTER_ID = 'TEST-CLUSTER-01';
// Kept separate from CLUSTER_ID so these fixture parcels don't leak into
// the compare() tests below, which query every parcel in a cluster broadly.
const MAP_ONLY_CLUSTER_ID = 'TEST-CLUSTER-02';

describe('Historical Imagery (e2e)', () => {
  let app: INestApplication;
  let parcelRepository: Repository<Parcel>;
  let historicalStateRepository: Repository<ParcelHistoricalState>;
  let disputeRepository: Repository<DisputeRecord>;
  let restrictionRepository: Repository<RestrictionRecord>;
  let snapshotRepository: Repository<ClusterHistoricalSnapshot>;
  let alertRepository: Repository<GovernanceAlert>;
  let tmpDir: string;
  let officerAuth: string;
  let citizenAuth: string;

  const mockExplainParcelChanges = jest.fn();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(NarrativeService)
      .useValue({ explainParcelChanges: mockExplainParcelChanges })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();

    parcelRepository = moduleFixture.get(getRepositoryToken(Parcel));
    historicalStateRepository = moduleFixture.get(getRepositoryToken(ParcelHistoricalState));
    disputeRepository = moduleFixture.get(getRepositoryToken(DisputeRecord));
    restrictionRepository = moduleFixture.get(getRepositoryToken(RestrictionRecord));
    snapshotRepository = moduleFixture.get(getRepositoryToken(ClusterHistoricalSnapshot));
    alertRepository = moduleFixture.get(getRepositoryToken(GovernanceAlert));

    officerAuth = (await createAuthenticatedUser(moduleFixture, 'LAND_RECORD_OFFICER')).authHeader;
    citizenAuth = (await createAuthenticatedUser(moduleFixture, 'CITIZEN')).authHeader;

    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bhoomisetu-historical-imagery-test-'));
    const flatImage = await makeFlatImage();
    const bounds = { minLng: 73.849, minLat: 18.519, maxLng: 73.852, maxLat: 18.522 };
    const imagePaths: Record<number, string> = {};
    for (const year of [OLD_YEAR, PREVIOUS_YEAR, CURRENT_YEAR]) {
      imagePaths[year] = path.join(tmpDir, `${CLUSTER_ID}-${year}.png`);
      await fs.writeFile(imagePaths[year], flatImage);
    }
    await snapshotRepository.save(
      Object.entries(imagePaths).map(([year, imagePath]) => ({
        clusterId: CLUSTER_ID,
        year: Number(year),
        imagePath,
        bounds: JSON.stringify(bounds),
      })),
    );
  });

  afterAll(async () => {
    await app.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('GET /api/v1/historical-imagery/clusters', () => {
    it('lists the seeded cluster and its available years', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/historical-imagery/clusters')
        .set('Authorization', officerAuth)
        .expect(200);

      const entry = res.body.find((c: any) => c.clusterId === CLUSTER_ID);
      expect(entry.years).toEqual([OLD_YEAR, PREVIOUS_YEAR, CURRENT_YEAR]);
    });

    // Public (2026-09-08) - Parcel 360's own citizen-facing embed needs this;
    // a cluster listing (id/year list) carries none of the owner-only detail
    // that GET /parcels/:id/360 itself withholds from a non-owner viewer.
    it('is public - a citizen and an unauthenticated request can both list clusters', async () => {
      await request(app.getHttpServer()).get('/api/v1/historical-imagery/clusters').set('Authorization', citizenAuth).expect(200);
      await request(app.getHttpServer()).get('/api/v1/historical-imagery/clusters').expect(200);
    });
  });

  describe('GET /api/v1/historical-imagery/clusters/:clusterId/years/:year/image', () => {
    it('serves the stored PNG', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/years/${OLD_YEAR}/image`)
        .set('Authorization', officerAuth)
        .expect(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('returns 404 for a year with no snapshot', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/years/1999/image`)
        .set('Authorization', officerAuth)
        .expect(404);
    });

    // Unlike listClusters/getParcelsForYear above, this one stays staff-only
    // - it's not part of the citizen-facing embed (superseded by the real
    // map view), no reason to widen it too.
    it('rejects a citizen with 403', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/years/${OLD_YEAR}/image`)
        .set('Authorization', citizenAuth)
        .expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/years/${OLD_YEAR}/image`)
        .expect(401);
    });
  });

  describe('GET /api/v1/historical-imagery/clusters/:clusterId/years/:year/parcels', () => {
    it('returns each parcel with its real geometry and a real ParcelCategory for that year', async () => {
      const geometry = square(73.9, 18.6);
      const parcel = await parcelRepository.save({
        canonicalParcelId: 'HI-MAP-RESTRICTED', clusterId: MAP_ONLY_CLUSTER_ID, stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001',
        areaSqM: 100, geometry,
      });
      await historicalStateRepository.save({ parcelId: parcel.id, year: OLD_YEAR, restrictionStatus: 'RESTRICTED' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/historical-imagery/clusters/${MAP_ONLY_CLUSTER_ID}/years/${OLD_YEAR}/parcels`)
        .set('Authorization', officerAuth)
        .expect(200);

      const row = res.body.find((p: any) => p.canonicalParcelId === 'HI-MAP-RESTRICTED');
      expect(row.category).toBe('RESTRICTED');
      expect(JSON.parse(row.geometry)).toEqual(JSON.parse(geometry));
      expect(row.id).toBe(parcel.id);
    });

    it('applies real active dispute status only for CURRENT_YEAR, never for a purely historical year', async () => {
      const parcel = await parcelRepository.save({
        canonicalParcelId: 'HI-MAP-DISPUTE', clusterId: MAP_ONLY_CLUSTER_ID, stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001',
        areaSqM: 100, geometry: square(73.91, 18.61),
      });
      await disputeRepository.save({ parcelId: parcel.id, hasActiveDispute: true, disputeType: 'INHERITANCE', caseStatus: 'FILED' });

      const currentRes = await request(app.getHttpServer())
        .get(`/api/v1/historical-imagery/clusters/${MAP_ONLY_CLUSTER_ID}/years/${CURRENT_YEAR}/parcels`)
        .set('Authorization', officerAuth)
        .expect(200);
      expect(currentRes.body.find((p: any) => p.canonicalParcelId === 'HI-MAP-DISPUTE').category).toBe('DISPUTE_INHERITANCE');

      const oldRes = await request(app.getHttpServer())
        .get(`/api/v1/historical-imagery/clusters/${MAP_ONLY_CLUSTER_ID}/years/${OLD_YEAR}/parcels`)
        .set('Authorization', officerAuth)
        .expect(200);
      expect(oldRes.body.find((p: any) => p.canonicalParcelId === 'HI-MAP-DISPUTE').category).toBe('NONE');
    });

    // Public (2026-09-08) - this is exactly what Parcel 360's citizen-facing
    // "Historical Boundaries" map calls; see the GET /clusters test above
    // for why this doesn't expose anything new.
    it('is public - a citizen and an unauthenticated request can both fetch a year\'s parcels', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/historical-imagery/clusters/${MAP_ONLY_CLUSTER_ID}/years/${CURRENT_YEAR}/parcels`)
        .set('Authorization', citizenAuth)
        .expect(200);
      await request(app.getHttpServer())
        .get(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/years/${CURRENT_YEAR}/parcels`)
        .expect(200);
    });
  });

  describe('POST /api/v1/historical-imagery/clusters/:clusterId/compare', () => {
    afterEach(() => mockExplainParcelChanges.mockClear());

    it('detects real category changes, creates correctly-severed alerts, and leaves unaffected/improved parcels alone', async () => {
      const criticalDisputeParcel = await parcelRepository.save({
        canonicalParcelId: 'HI-CRITICAL-DISPUTE', clusterId: CLUSTER_ID, stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 100,
        geometry: square(73.8501, 18.5201),
      });
      const highDisputeParcel = await parcelRepository.save({
        canonicalParcelId: 'HI-HIGH-DISPUTE', clusterId: CLUSTER_ID, stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 100,
        geometry: square(73.8502, 18.5202),
      });
      const newRestrictionParcel = await parcelRepository.save({
        canonicalParcelId: 'HI-NEW-RESTRICTION', clusterId: CLUSTER_ID, stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 100,
        geometry: square(73.8503, 18.5203),
      });
      const clearedParcel = await parcelRepository.save({
        canonicalParcelId: 'HI-CLEARED', clusterId: CLUSTER_ID, stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 100,
        geometry: square(73.8504, 18.5204),
      });
      const unaffectedParcel = await parcelRepository.save({
        canonicalParcelId: 'HI-UNAFFECTED', clusterId: CLUSTER_ID, stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 100,
        geometry: square(73.8505, 18.5205),
      });

      await disputeRepository.save([
        { parcelId: criticalDisputeParcel.id, hasActiveDispute: true, disputeType: 'ENCROACHMENT', caseStatus: 'FILED', filingDate: '2026-03-01' },
        { parcelId: highDisputeParcel.id, hasActiveDispute: true, disputeType: 'BOUNDARY', caseStatus: 'UNDER_REVIEW', filingDate: '2026-02-01' },
      ]);
      await restrictionRepository.save([
        { parcelId: criticalDisputeParcel.id, hasRestriction: true, restrictionType: 'FLOOD_PRONE' },
      ]);
      await historicalStateRepository.save([
        { parcelId: criticalDisputeParcel.id, year: PREVIOUS_YEAR, restrictionStatus: 'UNRESTRICTED' },
        { parcelId: criticalDisputeParcel.id, year: CURRENT_YEAR, restrictionStatus: 'UNRESTRICTED' },
        { parcelId: highDisputeParcel.id, year: PREVIOUS_YEAR, restrictionStatus: 'UNRESTRICTED' },
        { parcelId: highDisputeParcel.id, year: CURRENT_YEAR, restrictionStatus: 'UNRESTRICTED' },
        { parcelId: newRestrictionParcel.id, year: PREVIOUS_YEAR, restrictionStatus: 'UNRESTRICTED' },
        { parcelId: newRestrictionParcel.id, year: CURRENT_YEAR, restrictionStatus: 'RESTRICTED' },
        { parcelId: clearedParcel.id, year: PREVIOUS_YEAR, restrictionStatus: 'RESTRICTED' },
        { parcelId: clearedParcel.id, year: CURRENT_YEAR, restrictionStatus: 'UNRESTRICTED' },
        { parcelId: unaffectedParcel.id, year: PREVIOUS_YEAR, restrictionStatus: 'UNRESTRICTED' },
        { parcelId: unaffectedParcel.id, year: CURRENT_YEAR, restrictionStatus: 'UNRESTRICTED' },
      ]);

      mockExplainParcelChanges.mockResolvedValue(
        new Map([
          ['HI-CRITICAL-DISPUTE', 'This parcel has an active encroachment dispute filed in March 2026, in a flood-restricted zone.'],
          ['HI-HIGH-DISPUTE', 'This parcel has an active boundary dispute filed in February 2026.'],
          ['HI-NEW-RESTRICTION', 'This parcel newly fell under a recorded restriction in 2026.'],
          ['HI-CLEARED', 'The restriction previously on this parcel is no longer active.'],
        ]),
      );

      const res = await request(app.getHttpServer())
        .post(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/compare`)
        .set('Authorization', officerAuth)
        .send({ fromYear: PREVIOUS_YEAR, toYear: CURRENT_YEAR })
        .expect(201);

      expect(res.body.changeDetected).toBe(true);
      const byId = Object.fromEntries(res.body.affectedParcels.map((p: any) => [p.canonicalParcelId, p]));

      expect(Object.keys(byId).sort()).toEqual(['HI-CLEARED', 'HI-CRITICAL-DISPUTE', 'HI-HIGH-DISPUTE', 'HI-NEW-RESTRICTION']);

      expect(byId['HI-CRITICAL-DISPUTE'].toCategory).toBe('DISPUTE_ENCROACHMENT');
      expect(byId['HI-CRITICAL-DISPUTE'].narrative).toContain('encroachment dispute');
      expect(byId['HI-CRITICAL-DISPUTE'].alertId).toBeTruthy();
      const criticalAlert = await alertRepository.findOneBy({ id: byId['HI-CRITICAL-DISPUTE'].alertId });
      expect(criticalAlert).toMatchObject({ alertType: 'DISPUTE_DETECTED', severity: 'CRITICAL', source: 'HISTORICAL_IMAGERY', status: 'OPEN' });

      expect(byId['HI-HIGH-DISPUTE'].toCategory).toBe('DISPUTE_BOUNDARY');
      const highAlert = await alertRepository.findOneBy({ id: byId['HI-HIGH-DISPUTE'].alertId });
      expect(highAlert).toMatchObject({ alertType: 'DISPUTE_DETECTED', severity: 'HIGH' });

      expect(byId['HI-NEW-RESTRICTION'].fromCategory).toBe('NONE');
      expect(byId['HI-NEW-RESTRICTION'].toCategory).toBe('RESTRICTED');
      const restrictionAlert = await alertRepository.findOneBy({ id: byId['HI-NEW-RESTRICTION'].alertId });
      expect(restrictionAlert).toMatchObject({ alertType: 'RESTRICTION_DETECTED', severity: 'MEDIUM' });

      // A parcel whose problem cleared (RESTRICTED -> NONE) is still reported
      // in the list, but must NOT get a fresh alert - nothing wrong now.
      expect(byId['HI-CLEARED'].fromCategory).toBe('RESTRICTED');
      expect(byId['HI-CLEARED'].toCategory).toBe('NONE');
      expect(byId['HI-CLEARED'].alertId).toBeNull();

      // A parcel whose category never changed shouldn't appear at all.
      expect(byId['HI-UNAFFECTED']).toBeUndefined();

      expect(mockExplainParcelChanges).toHaveBeenCalledTimes(1);
      const callArgs = mockExplainParcelChanges.mock.calls[0];
      expect(callArgs[0]).toBe(PREVIOUS_YEAR);
      expect(callArgs[1]).toBe(CURRENT_YEAR);
      expect(callArgs[2]).toHaveLength(4);
    });

    it('falls back to the real underlying facts as the narrative when the vision call fails - never blocks the result', async () => {
      const parcel = await parcelRepository.save({
        canonicalParcelId: 'HI-FALLBACK', clusterId: CLUSTER_ID, stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 100,
        geometry: square(73.86, 18.53),
      });
      await historicalStateRepository.save([
        { parcelId: parcel.id, year: PREVIOUS_YEAR, restrictionStatus: 'UNRESTRICTED' },
        { parcelId: parcel.id, year: CURRENT_YEAR, restrictionStatus: 'RESTRICTED' },
      ]);
      mockExplainParcelChanges.mockRejectedValueOnce(new Error('Vision AI service is not configured'));

      const res = await request(app.getHttpServer())
        .post(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/compare`)
        .set('Authorization', officerAuth)
        .send({ fromYear: PREVIOUS_YEAR, toYear: CURRENT_YEAR })
        .expect(201);

      expect(res.body.changeDetected).toBe(true);
      const row = res.body.affectedParcels.find((p: any) => p.canonicalParcelId === 'HI-FALLBACK');
      expect(row.narrative).toContain('RESTRICTED');
      expect(row.alertId).toBeTruthy();
    });

    it('returns 404 for a missing snapshot even when the year pair is otherwise valid', async () => {
      // MAP_ONLY_CLUSTER_ID has real parcels but no ClusterHistoricalSnapshot
      // rows at all - the year pair itself passes the CURRENT_YEAR-1/CURRENT_YEAR
      // guard, so this exercises the snapshot-existence check behind it.
      await request(app.getHttpServer())
        .post(`/api/v1/historical-imagery/clusters/${MAP_ONLY_CLUSTER_ID}/compare`)
        .set('Authorization', officerAuth)
        .send({ fromYear: PREVIOUS_YEAR, toYear: CURRENT_YEAR })
        .expect(404);
    });

    it('rejects a citizen with 403', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/compare`)
        .set('Authorization', citizenAuth)
        .send({ fromYear: PREVIOUS_YEAR, toYear: CURRENT_YEAR })
        .expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/compare`)
        .send({ fromYear: PREVIOUS_YEAR, toYear: CURRENT_YEAR })
        .expect(401);
    });

    it('rejects a malformed body with 400', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/compare`)
        .set('Authorization', officerAuth)
        .send({ fromYear: 'not-a-year', toYear: CURRENT_YEAR })
        .expect(400);
    });

    // Governance-alert-generating comparisons must always be exactly
    // PREVIOUS_YEAR -> CURRENT_YEAR - every other pair is rejected before
    // it ever reaches a snapshot lookup, regardless of whether those years
    // actually have snapshots.
    describe('year-pair restriction (only PREVIOUS_YEAR -> CURRENT_YEAR generates alerts)', () => {
      it('rejects an arbitrary historical pair with 400', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/compare`)
          .set('Authorization', officerAuth)
          .send({ fromYear: OLD_YEAR, toYear: PREVIOUS_YEAR })
          .expect(400);
        expect(res.body.message).toContain(`${PREVIOUS_YEAR}`);
        expect(res.body.message).toContain(`${CURRENT_YEAR}`);
      });

      it('rejects the reversed pair (CURRENT_YEAR -> PREVIOUS_YEAR) with 400', async () => {
        await request(app.getHttpServer())
          .post(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/compare`)
          .set('Authorization', officerAuth)
          .send({ fromYear: CURRENT_YEAR, toYear: PREVIOUS_YEAR })
          .expect(400);
      });

      it('rejects a same-year comparison with 400', async () => {
        await request(app.getHttpServer())
          .post(`/api/v1/historical-imagery/clusters/${CLUSTER_ID}/compare`)
          .set('Authorization', officerAuth)
          .send({ fromYear: CURRENT_YEAR, toYear: CURRENT_YEAR })
          .expect(400);
      });
    });
  });
});
