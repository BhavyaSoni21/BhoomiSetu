process.env.USE_SQLITE = 'true';
process.env.SQLITE_PATH = ':memory:';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { Parcel } from '../src/parcels/parcel.entity';
import { TaxRecord } from '../src/departments/tax-record.entity';
import { DisputeRecord } from '../src/departments/dispute-record.entity';
import { RestrictionRecord } from '../src/departments/restriction-record.entity';
import { GovernanceAlert } from '../src/governance/governance-alert.entity';
import { createAuthenticatedUser } from './helpers/auth';

const square = (minLng: number, minLat: number, size = 0.001) =>
  JSON.stringify({
    type: 'Polygon',
    coordinates: [[
      [minLng, minLat], [minLng + size, minLat], [minLng + size, minLat + size], [minLng, minLat + size], [minLng, minLat],
    ]],
  });

describe('Predictive Analytics (e2e)', () => {
  let app: INestApplication;
  let parcelRepository: Repository<Parcel>;
  let taxRepository: Repository<TaxRecord>;
  let disputeRepository: Repository<DisputeRecord>;
  let restrictionRepository: Repository<RestrictionRecord>;
  let alertRepository: Repository<GovernanceAlert>;

  // Parcel A: only a tax record (OVERDUE, 50% of assessed value outstanding).
  //   tax factor = clamp(60 + clamp(0.5*400,0,40), 0, 100) = 100, weight 0.4
  //   alerts factor = 0 (no open alerts, but always "available"), weight 0.2
  //   overall = round((100*0.4 + 0*0.2) / 0.6) = round(66.67) = 67 -> HIGH
  let parcelA: Parcel;
  // Parcel B: only an active OWNERSHIP dispute.
  //   dispute factor = 90, weight 0.3; alerts factor = 0, weight 0.2
  //   overall = round((90*0.3 + 0*0.2) / 0.5) = round(54) = 54 -> HIGH
  let parcelB: Parcel;
  // Parcel C: all four factors present (tax PAID, active BOUNDARY dispute,
  // FLOOD_PRONE restriction, one open CRITICAL alert).
  //   overall = round(0*0.4 + 65*0.3 + 100*0.2 + 60*0.1) = round(45.5) = 46 -> MEDIUM
  let parcelC: Parcel;
  // Parcel D: no department records at all.
  //   only the alerts factor is available (score 0, weight 0.2)
  //   overall = round(0 / 0.2) = 0 -> LOW, dataCompleteness = 0.2
  let parcelD: Parcel;
  // GET /predictive-analytics/top-risk-parcels is admin-only
  // (docs/FEATURE_AUDIT.md §8 item 5) - GET /parcels/:id/risk-score stays
  // public, it's shown to citizens on Parcel 360.
  let adminAuth: string;
  let officerAuth: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    parcelRepository = moduleFixture.get(getRepositoryToken(Parcel));
    taxRepository = moduleFixture.get(getRepositoryToken(TaxRecord));
    disputeRepository = moduleFixture.get(getRepositoryToken(DisputeRecord));
    restrictionRepository = moduleFixture.get(getRepositoryToken(RestrictionRecord));
    alertRepository = moduleFixture.get(getRepositoryToken(GovernanceAlert));

    [parcelA, parcelB, parcelC, parcelD] = await Promise.all([
      parcelRepository.save({ canonicalParcelId: 'PA-1', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 100, geometry: square(73.85, 18.52) }),
      parcelRepository.save({ canonicalParcelId: 'PA-2', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 100, geometry: square(73.86, 18.53) }),
      parcelRepository.save({ canonicalParcelId: 'PA-3', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 100, geometry: square(73.87, 18.54) }),
      parcelRepository.save({ canonicalParcelId: 'PA-4', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 100, geometry: square(73.88, 18.55) }),
    ]);

    await taxRepository.save([
      { parcelId: parcelA.id, assessedValue: 1000, annualTaxAmount: 10, taxStatus: 'OVERDUE', outstandingAmount: 500 },
      { parcelId: parcelC.id, assessedValue: 1000, annualTaxAmount: 10, taxStatus: 'PAID', outstandingAmount: 0 },
    ]);
    await disputeRepository.save([
      { parcelId: parcelB.id, hasActiveDispute: true, disputeType: 'OWNERSHIP', caseStatus: 'FILED' },
      { parcelId: parcelC.id, hasActiveDispute: true, disputeType: 'BOUNDARY', caseStatus: 'UNDER_REVIEW' },
    ]);
    await restrictionRepository.save([
      { parcelId: parcelC.id, hasRestriction: true, restrictionType: 'FLOOD_PRONE', imposingAuthority: 'Irrigation Dept' },
    ]);
    await alertRepository.save([
      { parcelId: parcelC.id, alertType: 'UNAUTHORIZED_CHANGE_DETECTED', severity: 'CRITICAL', source: 'CHANGE_DETECTION', status: 'OPEN', explanation: 'x' },
      // A DISMISSED alert on parcel D must not count toward its score.
      { parcelId: parcelD.id, alertType: 'TAX_OVERDUE', severity: 'HIGH', source: 'TAX_MONITOR', status: 'DISMISSED', explanation: 'x' },
    ]);

    adminAuth = (await createAuthenticatedUser(moduleFixture, 'ADMIN')).authHeader;
    officerAuth = (await createAuthenticatedUser(moduleFixture, 'LAND_RECORD_OFFICER')).authHeader;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/parcels/:id/risk-score', () => {
    it('scores a parcel with only a tax record, excluding unavailable factors from the average', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/parcels/${parcelA.id}/risk-score`).expect(200);
      expect(res.body.overallScore).toBe(67);
      expect(res.body.riskBand).toBe('HIGH');
      expect(res.body.dataCompleteness).toBeCloseTo(0.6);

      const byKey = Object.fromEntries(res.body.factors.map((f: any) => [f.key, f]));
      expect(byKey.TAX_DELINQUENCY.available).toBe(true);
      expect(byKey.TAX_DELINQUENCY.score).toBe(100);
      expect(byKey.ACTIVE_DISPUTE.available).toBe(false);
      expect(byKey.RESTRICTION.available).toBe(false);
      expect(byKey.GOVERNANCE_ALERTS.available).toBe(true);
      expect(byKey.GOVERNANCE_ALERTS.score).toBe(0);
    });

    it('scores a parcel with only an active ownership dispute', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/parcels/${parcelB.id}/risk-score`).expect(200);
      expect(res.body.overallScore).toBe(54);
      expect(res.body.riskBand).toBe('HIGH');

      const byKey = Object.fromEntries(res.body.factors.map((f: any) => [f.key, f]));
      expect(byKey.ACTIVE_DISPUTE.score).toBe(90);
      expect(byKey.ACTIVE_DISPUTE.rationale).toMatch(/ownership dispute is filed/i);
    });

    it('combines all four factors when every department has a record', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/parcels/${parcelC.id}/risk-score`).expect(200);
      expect(res.body.overallScore).toBe(46);
      expect(res.body.riskBand).toBe('MEDIUM');
      expect(res.body.dataCompleteness).toBeCloseTo(1);

      const byKey = Object.fromEntries(res.body.factors.map((f: any) => [f.key, f]));
      expect(byKey.TAX_DELINQUENCY.score).toBe(0);
      expect(byKey.ACTIVE_DISPUTE.score).toBe(65);
      expect(byKey.GOVERNANCE_ALERTS.score).toBe(100);
      expect(byKey.RESTRICTION.score).toBe(60);
    });

    it('scores a parcel with no department records as LOW with low data completeness', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/parcels/${parcelD.id}/risk-score`).expect(200);
      expect(res.body.overallScore).toBe(0);
      expect(res.body.riskBand).toBe('LOW');
      expect(res.body.dataCompleteness).toBeCloseTo(0.2);

      // The DISMISSED alert must not count as an open alert.
      const byKey = Object.fromEntries(res.body.factors.map((f: any) => [f.key, f]));
      expect(byKey.GOVERNANCE_ALERTS.score).toBe(0);
      expect(byKey.GOVERNANCE_ALERTS.rationale).toMatch(/no open governance alerts/i);
    });

    it('returns 404 for a parcel that does not exist', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/parcels/00000000-0000-0000-0000-000000000000/risk-score')
        .expect(404);
    });
  });

  describe('GET /api/v1/predictive-analytics/top-risk-parcels', () => {
    it('ranks parcels by overall score, highest first', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/predictive-analytics/top-risk-parcels')
        .set('Authorization', adminAuth)
        .expect(200);
      const ids = res.body.map((r: any) => r.parcelId);
      expect(ids.indexOf(parcelA.id)).toBeLessThan(ids.indexOf(parcelB.id));
      expect(ids.indexOf(parcelB.id)).toBeLessThan(ids.indexOf(parcelC.id));
      expect(ids.indexOf(parcelC.id)).toBeLessThan(ids.indexOf(parcelD.id));
    });

    it('respects the limit query parameter', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/predictive-analytics/top-risk-parcels?limit=2')
        .set('Authorization', adminAuth)
        .expect(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].parcelId).toBe(parcelA.id);
      expect(res.body[1].parcelId).toBe(parcelB.id);
    });

    it('rejects a non-admin officer with 403', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/predictive-analytics/top-risk-parcels')
        .set('Authorization', officerAuth)
        .expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/predictive-analytics/top-risk-parcels').expect(401);
    });
  });
});
