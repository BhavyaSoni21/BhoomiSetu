process.env.USE_SQLITE = 'true';
process.env.SQLITE_PATH = ':memory:';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { Parcel } from '../src/parcels/parcel.entity';
import { CitizenParcel } from '../src/parcels/citizen-parcel.entity';
import { createAuthenticatedUser } from './helpers/auth';

const square = (minLng: number, minLat: number, size = 0.001) =>
  JSON.stringify({
    type: 'Polygon',
    coordinates: [[
      [minLng, minLat], [minLng + size, minLat], [minLng + size, minLat + size], [minLng, minLat + size], [minLng, minLat],
    ]],
  });

describe('Workflows (service requests) (e2e)', () => {
  let app: INestApplication;
  let parcelRepository: Repository<Parcel>;
  let parcel: Parcel;
  let otherParcel: Parcel;
  // GET (list/single) and PATCH .../status, .../steps/:stepId are all
  // officer/admin-only as of docs/FEATURE_AUDIT.md §8 item 5. POST (the
  // citizen service-request flow) is CITIZEN-only as of docs/flow.md §9 -
  // filing moved from anonymous/public to account-gated now that real
  // citizen accounts exist end-to-end. adminAuth bypasses the per-step
  // department check (see workflows.service.ts); the per-department tokens
  // exercise that check for real.
  let adminAuth: string;
  let landRecordsAuth: string;
  let registrationAuth: string;
  let citizenAuth: string;
  let unassociatedCitizenAuth: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    parcelRepository = moduleFixture.get(getRepositoryToken(Parcel));
    const citizenParcelRepository: Repository<CitizenParcel> = moduleFixture.get(getRepositoryToken(CitizenParcel));

    parcel = await parcelRepository.save({
      canonicalParcelId: 'WF-1', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 500, geometry: square(73.85, 18.52),
    });
    otherParcel = await parcelRepository.save({
      canonicalParcelId: 'WF-2', stateCode: 'DL', districtCode: 'NEW', localBodyCode: 'DLLB001', areaSqM: 300, geometry: square(77.2, 28.6),
    });

    adminAuth = (await createAuthenticatedUser(moduleFixture, 'ADMIN')).authHeader;
    landRecordsAuth = (await createAuthenticatedUser(moduleFixture, 'LAND_RECORD_OFFICER')).authHeader;
    registrationAuth = (await createAuthenticatedUser(moduleFixture, 'REGISTRATION_OFFICER')).authHeader;

    // Every POST /workflows test below files a request as this citizen
    // against `parcel`/`otherParcel`, so both are linked here (docs/FRONTEND_UPGRADE_SPEC.md
    // §4's "Raise Request only for associated parcels" - see workflows.controller.ts create()).
    const citizenAuthResult = await createAuthenticatedUser(moduleFixture, 'CITIZEN');
    citizenAuth = citizenAuthResult.authHeader;
    await citizenParcelRepository.save({ citizen: citizenAuthResult.user, parcel });
    await citizenParcelRepository.save({ citizen: citizenAuthResult.user, parcel: otherParcel });

    unassociatedCitizenAuth = (await createAuthenticatedUser(moduleFixture, 'CITIZEN')).authHeader;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/workflows', () => {
    it('creates a workflow with SUBMITTED status and auto-generates the 3-step review pipeline', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST', createdBy: 'Jane Citizen', requestDetails: 'Need a copy for a loan application' })
        .expect(201);

      expect(res.body.currentStatus).toBe('SUBMITTED');
      expect(res.body.parcelId).toBe(parcel.id);
      expect(res.body.steps).toHaveLength(3);
      expect(res.body.steps.map((s: any) => s.department)).toEqual(['LAND_RECORDS', 'REGISTRATION', 'PLANNING']);
      expect(res.body.steps.every((s: any) => s.status === 'PENDING')).toBe(true);
      expect(res.body.steps.map((s: any) => s.stepOrder)).toEqual([1, 2, 3]);
    });

    it('accepts a workflow with no createdBy/requestDetails (both optional) and defaults createdBy to the filing citizen', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'CORRECTION_REQUEST' })
        .expect(201);
      expect(res.body.createdBy).toMatch(/^Test CITIZEN/);
      expect(res.body.requestDetails).toBeNull();
    });

    it('rejects a request for a non-existent parcel with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: '00000000-0000-0000-0000-000000000000', workflowType: 'ROR_COPY_REQUEST' })
        .expect(400);
    });

    it('rejects a request missing required fields with 400', async () => {
      await request(app.getHttpServer()).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ workflowType: 'ROR_COPY_REQUEST' }).expect(400);
      await request(app.getHttpServer()).post('/api/v1/workflows').set('Authorization', citizenAuth).send({ parcelId: parcel.id }).expect(400);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(401);
    });

    it('rejects a staff account (non-citizen) filing a request with 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', landRecordsAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(403);
    });

    it("rejects a citizen filing a request for a parcel not associated with their account, with 403", async () => {
      await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', unassociatedCitizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(403);
    });

    it('a DISPUTE_FILING workflow gets its own single-step DISPUTE review, not the default 3-step pipeline', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'DISPUTE_FILING', requestDetails: 'Boundary dispute with neighbouring parcel' })
        .expect(201);

      expect(res.body.steps).toHaveLength(1);
      expect(res.body.steps[0]).toEqual(
        expect.objectContaining({ department: 'DISPUTE', assignedRole: 'DISPUTE_OFFICER', status: 'PENDING', stepOrder: 1 }),
      );
    });
  });

  describe('GET /api/v1/workflows/:id', () => {
    it('returns a workflow with its steps', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/workflows/${created.body.id}`)
        .set('Authorization', adminAuth)
        .expect(200);
      expect(res.body.id).toBe(created.body.id);
      expect(res.body.steps).toHaveLength(3);
    });

    it('rejects a non-UUID id with 400', async () => {
      await request(app.getHttpServer()).get('/api/v1/workflows/not-a-uuid').set('Authorization', adminAuth).expect(400);
    });

    it('returns 404 for a well-formed but unknown UUID', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/workflows/00000000-0000-0000-0000-000000000000')
        .set('Authorization', adminAuth)
        .expect(404);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/workflows/00000000-0000-0000-0000-000000000000').expect(401);
    });
  });

  describe('PATCH /api/v1/workflows/:id/status', () => {
    it('updates currentStatus and records remarks', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/status`)
        .set('Authorization', adminAuth)
        .send({ status: 'UNDER_REVIEW', remarks: 'Assigned to land records officer' })
        .expect(200);

      expect(res.body.currentStatus).toBe('UNDER_REVIEW');
      expect(res.body.lastRemarks).toBe('Assigned to land records officer');
      expect(res.body.steps).toHaveLength(3); // steps still attached after update
    });

    it('returns 404 for an unknown workflow', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/workflows/00000000-0000-0000-0000-000000000000/status')
        .set('Authorization', adminAuth)
        .send({ status: 'APPROVED' })
        .expect(404);
    });
  });

  describe('GET /api/v1/parcels/:id/workflows', () => {
    it('lists only workflows for that specific parcel, newest first', async () => {
      const first = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: otherParcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);
      // SQLite's CURRENT_TIMESTAMP has second-level resolution, so two
      // requests within the same second would sort as ties - wait past that
      // boundary so the "newest first" ordering is actually meaningful here.
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const second = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: otherParcel.id, workflowType: 'CORRECTION_REQUEST' })
        .expect(201);

      const res = await request(app.getHttpServer()).get(`/api/v1/parcels/${otherParcel.id}/workflows`).expect(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.every((w: any) => w.parcelId === otherParcel.id)).toBe(true);
      expect(res.body[0].id).toBe(second.body.id); // newest first
      expect(res.body[1].id).toBe(first.body.id);
    });

    it('returns an empty array for a parcel with no service requests', async () => {
      const freshParcel = await parcelRepository.save({
        canonicalParcelId: 'WF-3', stateCode: 'KA', districtCode: 'BAN', localBodyCode: 'KALB001', areaSqM: 200, geometry: square(77.5, 12.9),
      });
      const res = await request(app.getHttpServer()).get(`/api/v1/parcels/${freshParcel.id}/workflows`).expect(200);
      expect(res.body).toEqual([]);
    });

    it('returns 404 for an unknown parcel', async () => {
      await request(app.getHttpServer()).get('/api/v1/parcels/00000000-0000-0000-0000-000000000000/workflows').expect(404);
    });
  });

  describe('GET /api/v1/workflows (officer dashboard listing)', () => {
    it('filters by department AND stepStatus to the workflows with a matching pending step', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/v1/workflows?department=LAND_RECORDS&stepStatus=PENDING')
        .set('Authorization', landRecordsAuth)
        .expect(200);

      expect(res.body.some((w: any) => w.id === created.body.id)).toBe(true);
      expect(res.body.every((w: any) => w.steps.some((s: any) => s.department === 'LAND_RECORDS' && s.status === 'PENDING'))).toBe(true);
    });

    it('excludes a workflow whose matching-department step has already been decided', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);
      const landRecordsStep = created.body.steps.find((s: any) => s.department === 'LAND_RECORDS');

      await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${landRecordsStep.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/api/v1/workflows?department=LAND_RECORDS&stepStatus=PENDING')
        .set('Authorization', landRecordsAuth)
        .expect(200);
      expect(res.body.some((w: any) => w.id === created.body.id)).toBe(false);
    });

    it('returns every workflow when no filters are given (admin only - an officer always gets scoped to their own department)', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/workflows').set('Authorization', adminAuth).expect(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it("scopes an officer's request to their own department even if a different one is requested", async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);

      // A LAND_RECORD_OFFICER asking for REGISTRATION's queue still only
      // gets LAND_RECORDS steps back - the server ignores the requested
      // department and substitutes the caller's own.
      const res = await request(app.getHttpServer())
        .get('/api/v1/workflows?department=REGISTRATION')
        .set('Authorization', landRecordsAuth)
        .expect(200);

      expect(res.body.some((w: any) => w.id === created.body.id)).toBe(true);
      expect(res.body.every((w: any) => w.steps.some((s: any) => s.department === 'LAND_RECORDS'))).toBe(true);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/workflows').expect(401);
    });
  });

  describe('PATCH /api/v1/workflows/:workflowId/steps/:stepId (officer review action)', () => {
    it('approving every step moves the workflow to APPROVED', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);

      let last;
      for (const step of created.body.steps) {
        last = await request(app.getHttpServer())
          .patch(`/api/v1/workflows/${created.body.id}/steps/${step.id}`)
          .set('Authorization', adminAuth) // spans all 3 departments - ADMIN can decide any of them
          .send({ action: 'APPROVE', remarks: `${step.department} looks good` })
          .expect(200);
      }

      expect(last!.body.currentStatus).toBe('APPROVED');
      expect(last!.body.steps.every((s: any) => s.status === 'APPROVED')).toBe(true);
      expect(last!.body.steps.every((s: any) => s.completedAt !== null)).toBe(true);
    });

    it('rejecting one step moves the whole workflow to REJECTED, independent of other steps', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);
      const registrationStep = created.body.steps.find((s: any) => s.department === 'REGISTRATION');

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${registrationStep.id}`)
        .set('Authorization', registrationAuth)
        .send({ action: 'REJECT', remarks: 'Ownership mismatch' })
        .expect(200);

      expect(res.body.currentStatus).toBe('REJECTED');
      const decided = res.body.steps.find((s: any) => s.id === registrationStep.id);
      expect(decided.status).toBe('REJECTED');
      expect(decided.remarks).toBe('Ownership mismatch');
      // Other steps are left untouched, not force-cancelled.
      expect(res.body.steps.filter((s: any) => s.id !== registrationStep.id).every((s: any) => s.status === 'PENDING')).toBe(true);
    });

    it('a partially-approved workflow (not all steps decided) is IN_PROGRESS', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);
      const landRecordsStep = created.body.steps.find((s: any) => s.department === 'LAND_RECORDS');

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${landRecordsStep.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE' })
        .expect(200);

      expect(res.body.currentStatus).toBe('IN_PROGRESS');
    });

    it('rejects reviewing an already-decided step with 400', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);
      const step = created.body.steps[0]; // LAND_RECORDS, per the default pipeline order

      await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${step.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${step.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'REJECT' })
        .expect(400);
    });

    it('returns 404 for an unknown workflow', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/workflows/00000000-0000-0000-0000-000000000000/steps/00000000-0000-0000-0000-000000000000')
        .set('Authorization', adminAuth)
        .send({ action: 'APPROVE' })
        .expect(404);
    });

    it('returns 404 when the step does not belong to that workflow', async () => {
      const first = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);
      const second = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'CORRECTION_REQUEST' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${first.body.id}/steps/${second.body.steps[0].id}`)
        .set('Authorization', adminAuth)
        .send({ action: 'APPROVE' })
        .expect(404);
    });

    it('rejects an invalid action value with 400', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${created.body.steps[0].id}`)
        .set('Authorization', adminAuth)
        .send({ action: 'MAYBE' })
        .expect(400);
    });

    it('rejects an unauthenticated request with 401', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${created.body.steps[0].id}`)
        .send({ action: 'APPROVE' })
        .expect(401);
    });

    it('rejects an officer trying to decide a step outside their own department with 403', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);
      const registrationStep = created.body.steps.find((s: any) => s.department === 'REGISTRATION');

      // A LAND_RECORD_OFFICER, not a REGISTRATION_OFFICER, tries to decide
      // the REGISTRATION step.
      await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${registrationStep.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE' })
        .expect(403);

      // Confirm it's genuinely still PENDING, not silently decided.
      const stillPending = await request(app.getHttpServer())
        .get(`/api/v1/workflows/${created.body.id}`)
        .set('Authorization', adminAuth)
        .expect(200);
      expect(stillPending.body.steps.find((s: any) => s.id === registrationStep.id).status).toBe('PENDING');
    });

    it('lets ADMIN decide a step regardless of department', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);
      const planningStep = created.body.steps.find((s: any) => s.department === 'PLANNING');

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${planningStep.id}`)
        .set('Authorization', adminAuth)
        .send({ action: 'APPROVE' })
        .expect(200);

      expect(res.body.steps.find((s: any) => s.id === planningStep.id).status).toBe('APPROVED');
    });
  });

  describe('GET /api/v1/workflows/mine', () => {
    it("returns only the signed-in citizen's own requests, across all of their parcels", async () => {
      const own = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: otherParcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/v1/workflows/mine')
        .set('Authorization', citizenAuth)
        .expect(200);

      expect(res.body.some((w: any) => w.id === own.body.id)).toBe(true);
      expect(res.body.every((w: any) => [parcel.id, otherParcel.id].includes(w.parcelId))).toBe(true);
      expect(res.body[0].steps.length).toBeGreaterThan(0);
    });

    it('returns an empty array for a citizen with no parcels', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/workflows/mine')
        .set('Authorization', unassociatedCitizenAuth)
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('rejects a staff account with 403', async () => {
      await request(app.getHttpServer()).get('/api/v1/workflows/mine').set('Authorization', adminAuth).expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/workflows/mine').expect(401);
    });
  });
});
