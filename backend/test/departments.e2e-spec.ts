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
import { StateALandRecord } from '../src/land-records/state-a-land-record.entity';
import { StateBLandRecord } from '../src/land-records/state-b-land-record.entity';
import { RegistrationRecord } from '../src/departments/registration-record.entity';
import { PlanningRecord } from '../src/departments/planning-record.entity';
import { TaxRecord } from '../src/departments/tax-record.entity';
import { RestrictionRecord } from '../src/departments/restriction-record.entity';
import { DisputeRecord } from '../src/departments/dispute-record.entity';

describe('Mock department APIs (e2e)', () => {
  let app: INestApplication;
  let parcelRepository: Repository<Parcel>;
  let identifierRepository: Repository<ParcelIdentifier>;
  let stateARepository: Repository<StateALandRecord>;
  let stateBRepository: Repository<StateBLandRecord>;
  let registrationRepository: Repository<RegistrationRecord>;
  let planningRepository: Repository<PlanningRecord>;
  let taxRepository: Repository<TaxRecord>;
  let restrictionRepository: Repository<RestrictionRecord>;
  let disputeRepository: Repository<DisputeRecord>;

  let mhParcel: Parcel;
  let dlParcel: Parcel;
  let tnParcel: Parcel; // no state schema exists for TN in this mock

  const square = (minLng: number, minLat: number, size = 0.001) =>
    JSON.stringify({
      type: 'Polygon',
      coordinates: [[
        [minLng, minLat], [minLng + size, minLat], [minLng + size, minLat + size], [minLng, minLat + size], [minLng, minLat],
      ]],
    });

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
    stateARepository = moduleFixture.get(getRepositoryToken(StateALandRecord));
    stateBRepository = moduleFixture.get(getRepositoryToken(StateBLandRecord));
    registrationRepository = moduleFixture.get(getRepositoryToken(RegistrationRecord));
    planningRepository = moduleFixture.get(getRepositoryToken(PlanningRecord));
    taxRepository = moduleFixture.get(getRepositoryToken(TaxRecord));
    restrictionRepository = moduleFixture.get(getRepositoryToken(RestrictionRecord));
    disputeRepository = moduleFixture.get(getRepositoryToken(DisputeRecord));

    mhParcel = await parcelRepository.save({
      canonicalParcelId: 'DEPT-MH-1', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 500, geometry: square(73.85, 18.52),
    });
    dlParcel = await parcelRepository.save({
      canonicalParcelId: 'DEPT-DL-1', stateCode: 'DL', districtCode: 'NEW', localBodyCode: 'DLLB001', areaSqM: 300, geometry: square(77.2, 28.6),
    });
    tnParcel = await parcelRepository.save({
      canonicalParcelId: 'DEPT-TN-1', stateCode: 'TN', districtCode: 'CHE', localBodyCode: 'TNLB001', areaSqM: 400, geometry: square(80.27, 13.08),
    });

    await identifierRepository.save({
      parcel: mhParcel, identifierType: 'SURVEY_NUMBER', identifierValue: '77/9', sourceState: 'MH', sourceDepartment: 'Land Records',
    });
    await identifierRepository.save({
      parcel: dlParcel, identifierType: 'PLOT_NUMBER', identifierValue: 'P-4321', sourceState: 'DL', sourceDepartment: 'Land Records',
    });

    await stateARepository.save({
      surveyNumber: '77/9', subdivisionNumber: '2', ownerName: 'Match Owner A', villageCode: 'VIL777', areaHectares: 0.05,
    });
    await stateBRepository.save({
      plotId: 'P-4321', holderName: 'Match Owner B', localityId: 'LOC432', landExtentSqft: 3229, recordCategory: 'Urban',
    });

    await registrationRepository.save({
      parcelId: mhParcel.id, registrationStatus: 'REGISTERED', registrationNumber: 'REG-MH-1', registrationDate: '2020-01-01',
      lastTransactionType: 'SALE', lastTransactionDate: '2020-01-01',
    });
    await planningRepository.save({
      parcelId: mhParcel.id, landUse: 'RESIDENTIAL', zoningClassification: 'Residential-1', masterPlanReference: 'Pune Master Plan 2025',
      buildingPermissionStatus: 'APPROVED',
    });
    await taxRepository.save({
      parcelId: mhParcel.id, assessedValue: 1000000, annualTaxAmount: 5000, taxStatus: 'PENDING', outstandingAmount: 2500, lastPaymentDate: null,
    });
    await restrictionRepository.save({
      parcelId: mhParcel.id, hasRestriction: true, restrictionType: 'FLOOD_PRONE', restrictionDetails: 'Test flood flag', imposingAuthority: 'MH Env Authority',
    });
    await disputeRepository.save({
      parcelId: mhParcel.id, hasActiveDispute: true, disputeType: 'BOUNDARY', caseStatus: 'UNDER_REVIEW', filingDate: '2025-06-01', resolutionDate: null, resolutionSummary: null,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/land-records/:parcelId (Land Records department)', () => {
    it('resolves an MH parcel to its State A record via its SURVEY_NUMBER identifier', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/land-records/${mhParcel.id}`).expect(200);
      expect(res.body.source).toBe('STATE_A');
      expect(res.body.identifierUsed).toEqual({ type: 'SURVEY_NUMBER', value: '77/9' });
      expect(res.body.data.ownerName).toBe('Match Owner A');
    });

    it('resolves a DL parcel to its State B record via its PLOT_NUMBER identifier', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/land-records/${dlParcel.id}`).expect(200);
      expect(res.body.source).toBe('STATE_B');
      expect(res.body.identifierUsed).toEqual({ type: 'PLOT_NUMBER', value: 'P-4321' });
      expect(res.body.data.holderName).toBe('Match Owner B');
    });

    it('returns 404 for a state with no mock schema configured (TN)', async () => {
      await request(app.getHttpServer()).get(`/api/v1/land-records/${tnParcel.id}`).expect(404);
    });

    it('returns 404 for an unknown parcel id', async () => {
      await request(app.getHttpServer()).get('/api/v1/land-records/00000000-0000-0000-0000-000000000000').expect(404);
    });

    it('rejects a non-UUID id with 400', async () => {
      await request(app.getHttpServer()).get('/api/v1/land-records/not-a-uuid').expect(400);
    });
  });

  describe('GET /api/v1/registration/:parcelId', () => {
    it('returns registration status and transaction info for a parcel', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/registration/${mhParcel.id}`).expect(200);
      expect(res.body.registrationStatus).toBe('REGISTERED');
      expect(res.body.lastTransactionType).toBe('SALE');
    });

    it('returns 404 when no registration record exists for the parcel', async () => {
      await request(app.getHttpServer()).get(`/api/v1/registration/${dlParcel.id}`).expect(404);
    });
  });

  describe('GET /api/v1/planning/:parcelId', () => {
    it('returns land use and zoning info for a parcel', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/planning/${mhParcel.id}`).expect(200);
      expect(res.body.landUse).toBe('RESIDENTIAL');
      expect(res.body.buildingPermissionStatus).toBe('APPROVED');
    });

    it('returns 404 when no planning record exists for the parcel', async () => {
      await request(app.getHttpServer()).get(`/api/v1/planning/${dlParcel.id}`).expect(404);
    });
  });

  describe('GET /api/v1/tax/:parcelId', () => {
    it('returns assessed value, tax status, and outstanding amount for a parcel', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/tax/${mhParcel.id}`).expect(200);
      expect(res.body.taxStatus).toBe('PENDING');
      expect(Number(res.body.outstandingAmount)).toBe(2500);
    });

    it('returns 404 when no tax record exists for the parcel', async () => {
      await request(app.getHttpServer()).get(`/api/v1/tax/${dlParcel.id}`).expect(404);
    });
  });

  describe('GET /api/v1/restriction/:parcelId', () => {
    it('returns the restriction flag and type for a parcel', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/restriction/${mhParcel.id}`).expect(200);
      expect(res.body.hasRestriction).toBe(true);
      expect(res.body.restrictionType).toBe('FLOOD_PRONE');
    });

    it('returns 404 when no restriction record exists for the parcel', async () => {
      await request(app.getHttpServer()).get(`/api/v1/restriction/${dlParcel.id}`).expect(404);
    });
  });

  describe('GET /api/v1/dispute/:parcelId', () => {
    it('returns the dispute status for a parcel', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/dispute/${mhParcel.id}`).expect(200);
      expect(res.body.hasActiveDispute).toBe(true);
      expect(res.body.disputeType).toBe('BOUNDARY');
      expect(res.body.caseStatus).toBe('UNDER_REVIEW');
    });

    it('returns 404 when no dispute record exists for the parcel', async () => {
      await request(app.getHttpServer()).get(`/api/v1/dispute/${dlParcel.id}`).expect(404);
    });
  });

  describe('the department APIs operate independently', () => {
    it('each department only returns its own data shape - no field leakage between departments', async () => {
      const [registration, planning, tax, restriction, dispute] = await Promise.all([
        request(app.getHttpServer()).get(`/api/v1/registration/${mhParcel.id}`).expect(200),
        request(app.getHttpServer()).get(`/api/v1/planning/${mhParcel.id}`).expect(200),
        request(app.getHttpServer()).get(`/api/v1/tax/${mhParcel.id}`).expect(200),
        request(app.getHttpServer()).get(`/api/v1/restriction/${mhParcel.id}`).expect(200),
        request(app.getHttpServer()).get(`/api/v1/dispute/${mhParcel.id}`).expect(200),
      ]);

      expect(registration.body.landUse).toBeUndefined();
      expect(registration.body.taxStatus).toBeUndefined();
      expect(planning.body.registrationStatus).toBeUndefined();
      expect(planning.body.assessedValue).toBeUndefined();
      expect(tax.body.landUse).toBeUndefined();
      expect(tax.body.hasRestriction).toBeUndefined();
      expect(restriction.body.taxStatus).toBeUndefined();
      expect(restriction.body.landUse).toBeUndefined();
      expect(dispute.body.taxStatus).toBeUndefined();
      expect(dispute.body.hasRestriction).toBeUndefined();
    });
  });
});
