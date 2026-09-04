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
import { IdentifierResolverService } from '../src/interoperability/identifier-resolver.service';
import { ResponseAggregatorService } from '../src/interoperability/response-aggregator.service';
import { adaptStateA, adaptStateB } from '../src/interoperability/land-record-adapters';

const square = (minLng: number, minLat: number, size = 0.001) =>
  JSON.stringify({
    type: 'Polygon',
    coordinates: [[
      [minLng, minLat], [minLng + size, minLat], [minLng + size, minLat + size], [minLng, minLat + size], [minLng, minLat],
    ]],
  });

describe('Interoperability (e2e)', () => {
  let app: INestApplication;
  let parcelRepository: Repository<Parcel>;
  let identifierRepository: Repository<ParcelIdentifier>;
  let stateARepository: Repository<StateALandRecord>;
  let stateBRepository: Repository<StateBLandRecord>;
  let registrationRepository: Repository<RegistrationRecord>;
  let planningRepository: Repository<PlanningRecord>;
  let taxRepository: Repository<TaxRecord>;
  let restrictionRepository: Repository<RestrictionRecord>;
  let identifierResolver: IdentifierResolverService;
  let responseAggregator: ResponseAggregatorService;

  let fullMhParcel: Parcel; // fully wired: identifiers + State A + all 4 department records
  let bareTnParcel: Parcel; // exists, no identifiers, no department data at all

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
    identifierResolver = moduleFixture.get(IdentifierResolverService);
    responseAggregator = moduleFixture.get(ResponseAggregatorService);

    fullMhParcel = await parcelRepository.save({
      canonicalParcelId: 'INTEROP-MH-1', ulpin: 'ULPIN0009999999', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB009',
      areaSqM: 500, geometry: square(73.85, 18.52),
    });
    bareTnParcel = await parcelRepository.save({
      canonicalParcelId: 'INTEROP-TN-1', stateCode: 'TN', districtCode: 'CHE', localBodyCode: 'TNLB009', areaSqM: 400, geometry: square(80.27, 13.08),
    });

    await identifierRepository.save([
      { parcel: fullMhParcel, identifierType: 'SURVEY_NUMBER', identifierValue: '55/2', sourceState: 'MH', sourceDepartment: 'Land Records' },
      { parcel: fullMhParcel, identifierType: 'LOCAL_PARCEL_ID', identifierValue: 'MH-PUN-0099', sourceState: 'MH', sourceDepartment: 'Land Records' },
    ]);

    await stateARepository.save({
      surveyNumber: '55/2', subdivisionNumber: '3', ownerName: 'Interop Owner', villageCode: 'VIL555', areaHectares: 0.05, recordStatus: 'ACTIVE',
    });

    await registrationRepository.save({
      parcelId: fullMhParcel.id, registrationStatus: 'REGISTERED', registrationNumber: 'REG-1', registrationDate: '2020-01-01',
      lastTransactionType: 'SALE', lastTransactionDate: '2020-01-01',
    });
    await planningRepository.save({
      parcelId: fullMhParcel.id, landUse: 'RESIDENTIAL', zoningClassification: 'Residential-1', masterPlanReference: 'Pune Master Plan 2025', buildingPermissionStatus: 'APPROVED',
    });
    await taxRepository.save({
      parcelId: fullMhParcel.id, assessedValue: 100000, annualTaxAmount: 500, taxStatus: 'PAID', outstandingAmount: 0, lastPaymentDate: '2026-01-01',
    });
    await restrictionRepository.save({
      parcelId: fullMhParcel.id, hasRestriction: false, restrictionType: null, restrictionDetails: null, imposingAuthority: null,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('State A / State B adapters (Tech.md #14)', () => {
    it('adaptStateA maps survey_number/owner_name/area_hectares to canonical fields', () => {
      const adapted = adaptStateA({
        recordId: 'x', surveyNumber: '10/1', subdivisionNumber: '2', ownerName: 'Test Owner', villageCode: 'VIL010', areaHectares: 1, recordStatus: 'ACTIVE',
      });
      expect(adapted.sourceSchema).toBe('STATE_A');
      expect(adapted.sourceIdentifier).toBe('10/1');
      expect(adapted.ownerName).toBe('Test Owner');
      expect(adapted.areaSqM).toBe(10000); // 1 hectare = 10000 sqm exactly
      expect(adapted.locality).toBe('VIL010');
    });

    it('adaptStateB maps plot_id/holder_name/land_extent_sqft to canonical fields', () => {
      const adapted = adaptStateB({
        recordId: 'y', plotId: 'P-1', holderName: 'Test Holder', localityId: 'LOC1', landExtentSqft: 10763.9, recordCategory: 'Urban',
      });
      expect(adapted.sourceSchema).toBe('STATE_B');
      expect(adapted.sourceIdentifier).toBe('P-1');
      expect(adapted.ownerName).toBe('Test Holder');
      expect(adapted.areaSqM).toBeCloseTo(1000, 0); // 10763.9 sqft ~= 1000 sqm
      expect(adapted.locality).toBe('LOC1');
    });
  });

  describe('IdentifierResolverService', () => {
    it('resolves a parcel UUID from its canonicalParcelId', async () => {
      const id = await identifierResolver.resolveParcelId({ canonicalParcelId: 'INTEROP-MH-1' });
      expect(id).toBe(fullMhParcel.id);
    });

    it('resolves a parcel UUID from its ULPIN', async () => {
      const id = await identifierResolver.resolveParcelId({ ulpin: 'ULPIN0009999999' });
      expect(id).toBe(fullMhParcel.id);
    });

    it('resolves a parcel UUID from a parcel_identifiers row (survey_number)', async () => {
      const id = await identifierResolver.resolveParcelId({ surveyNumber: '55/2' });
      expect(id).toBe(fullMhParcel.id);
    });

    it('returns null when nothing matches', async () => {
      const id = await identifierResolver.resolveParcelId({ surveyNumber: 'DOES-NOT-EXIST' });
      expect(id).toBeNull();
    });

    it('resolves the department identifier a parcel would be looked up by (forward direction)', async () => {
      const value = await identifierResolver.resolveDepartmentIdentifier(fullMhParcel.id, 'SURVEY_NUMBER');
      expect(value).toBe('55/2');
    });
  });

  describe('ResponseAggregatorService.buildParcel360 (used by GET /api/v1/parcels/:id/360)', () => {
    it('returns null for an unknown parcel', async () => {
      const result = await responseAggregator.buildParcel360('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });

    it('aggregates all five departments into the canonical envelope for a fully-linked parcel', async () => {
      const result = await responseAggregator.buildParcel360(fullMhParcel.id);
      expect(result!.parcel_id).toBe(fullMhParcel.id);
      expect(result!.identifiers).toEqual({
        ulpin: 'ULPIN0009999999', survey_number: '55/2', plot_number: null, local_identifier: 'MH-PUN-0099',
      });
      expect(result!.location).toEqual({ state: 'MH', district: 'PUN', locality: 'VIL555' }); // locality from the resolved land record, not localBodyCode
      expect(result!.spatial.area_sq_m).toBe(500);
      expect(result!.sources).toEqual([
        { department: 'LAND_RECORDS', status: 'AVAILABLE' },
        { department: 'REGISTRATION', status: 'AVAILABLE' },
        { department: 'PLANNING', status: 'AVAILABLE' },
        { department: 'TAX', status: 'AVAILABLE' },
        { department: 'RESTRICTION', status: 'AVAILABLE' },
      ]);

      expect(result!.departments.landRecords).toEqual(
        expect.objectContaining({ sourceSchema: 'STATE_A', sourceIdentifier: '55/2', ownerName: 'Interop Owner', areaSqM: 500 }),
      );
      expect(result!.departments.registration!.registrationStatus).toBe('REGISTERED');
      expect(result!.departments.planning!.landUse).toBe('RESIDENTIAL');
      expect(result!.departments.tax!.taxStatus).toBe('PAID');
      expect(result!.departments.restriction!.hasRestriction).toBe(false);
    });

    it('falls back to localBodyCode for locality and nulls departments.* when nothing is linked', async () => {
      const result = await responseAggregator.buildParcel360(bareTnParcel.id);
      expect(result!.location.locality).toBe('TNLB009');
      expect(result!.departments).toEqual({
        landRecords: null, registration: null, planning: null, tax: null, restriction: null,
      });
      expect(result!.sources.every((s) => s.status === 'NOT_AVAILABLE')).toBe(true);
    });
  });

  describe('GET /api/v1/parcels/:id/360 end-to-end', () => {
    it('serves the same aggregated result through the HTTP endpoint', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/parcels/${fullMhParcel.id}/360`).expect(200);
      expect(res.body.parcel_id).toBe(fullMhParcel.id);
      expect(res.body.departments.landRecords.ownerName).toBe('Interop Owner');
      expect(res.body.departments.tax.taxStatus).toBe('PAID');
    });
  });
});
