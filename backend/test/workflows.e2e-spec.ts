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
import { ParcelDocument } from '../src/parcels/parcel-document.entity';
import { Notification } from '../src/notification-feed/notification.entity';
import { createAuthenticatedUser } from './helpers/auth';
import { renderParcelDocumentImage } from '../src/common/parcel-generation/parcel-document-generator';

const square = (minLng: number, minLat: number, size = 0.001) =>
  JSON.stringify({
    type: 'Polygon',
    coordinates: [[
      [minLng, minLat], [minLng + size, minLat], [minLng + size, minLat + size], [minLng, minLat + size], [minLng, minLat],
    ]],
  });

describe('Workflows (service requests) (e2e)', () => {
  let app: INestApplication;
  let testingModule: TestingModule;
  let parcelRepository: Repository<Parcel>;
  let citizenParcelRepository: Repository<CitizenParcel>;
  let parcelDocumentRepository: Repository<ParcelDocument>;
  let notificationRepository: Repository<Notification>;
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
  let landRecordsOfficerId: string;
  let registrationAuth: string;
  let citizenAuth: string;
  let citizenUserId: string;
  let unassociatedCitizenAuth: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    testingModule = moduleFixture;

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    parcelRepository = moduleFixture.get(getRepositoryToken(Parcel));
    notificationRepository = moduleFixture.get(getRepositoryToken(Notification));
    citizenParcelRepository = moduleFixture.get(getRepositoryToken(CitizenParcel));
    parcelDocumentRepository = moduleFixture.get(getRepositoryToken(ParcelDocument));

    parcel = await parcelRepository.save({
      canonicalParcelId: 'WF-1', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 500, geometry: square(73.85, 18.52),
    });
    otherParcel = await parcelRepository.save({
      canonicalParcelId: 'WF-2', stateCode: 'DL', districtCode: 'NEW', localBodyCode: 'DLLB001', areaSqM: 300, geometry: square(77.2, 28.6),
    });

    adminAuth = (await createAuthenticatedUser(moduleFixture, 'ADMIN')).authHeader;
    const landRecordsOfficer = await createAuthenticatedUser(moduleFixture, 'LAND_RECORD_OFFICER');
    landRecordsAuth = landRecordsOfficer.authHeader;
    landRecordsOfficerId = landRecordsOfficer.user.id;
    registrationAuth = (await createAuthenticatedUser(moduleFixture, 'REGISTRATION_OFFICER')).authHeader;

    // Every POST /workflows test below files a request as this citizen
    // against `parcel`/`otherParcel`, so both are linked here (docs/FRONTEND_UPGRADE_SPEC.md
    // §4's "Raise Request only for associated parcels" - see workflows.controller.ts create()).
    const citizenAuthResult = await createAuthenticatedUser(moduleFixture, 'CITIZEN');
    citizenAuth = citizenAuthResult.authHeader;
    citizenUserId = citizenAuthResult.user.id;
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
      // No GROQ_API_KEY in the test environment - RequestRoutingService's AI
      // call fails and falls back to the deterministic pipelineFor(), which
      // is exactly what the assertions above confirm; routingNotes stays
      // null since it's only ever set when the AI call actually succeeds.
      expect(res.body.routingNotes).toBeNull();
    });

    it('notifies every officer holding the assigned role(s) when a request is submitted', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);

      const notifications = await notificationRepository.find({ where: { userId: landRecordsOfficerId, type: 'WORKFLOW_ASSIGNED' } });
      const forThisWorkflow = notifications.find((n) => n.workflowId === res.body.id);
      expect(forThisWorkflow).toBeTruthy();
      expect(forThisWorkflow!.parcelId).toBe(parcel.id);
      expect(forThisWorkflow!.read).toBe(false);
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
        .send({ action: 'APPROVE', remarks: 'Approved' })
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
        .send({ action: 'APPROVE', remarks: 'Approved' })
        .expect(200);

      expect(res.body.currentStatus).toBe('IN_PROGRESS');
    });

    it('rejects a missing remarks with 400 - mandatory for both Approve and Reject', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);
      const step = created.body.steps[0];

      await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${step.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE' })
        .expect(400);
    });

    it('rejects an empty-string remarks with 400', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);
      const step = created.body.steps[0];

      await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${step.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'REJECT', remarks: '' })
        .expect(400);
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
        .send({ action: 'APPROVE', remarks: 'Approved' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${step.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'REJECT', remarks: 'Rejected' })
        .expect(400);
    });

    it('returns 404 for an unknown workflow', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/workflows/00000000-0000-0000-0000-000000000000/steps/00000000-0000-0000-0000-000000000000')
        .set('Authorization', adminAuth)
        .send({ action: 'APPROVE', remarks: 'Approved' })
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
        .send({ action: 'APPROVE', remarks: 'Approved' })
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
        .send({ action: 'APPROVE', remarks: 'Approved' })
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
        .send({ action: 'APPROVE', remarks: 'Approved' })
        .expect(403);

      // Confirm it's genuinely still PENDING, not silently decided.
      const stillPending = await request(app.getHttpServer())
        .get(`/api/v1/workflows/${created.body.id}`)
        .set('Authorization', adminAuth)
        .expect(200);
      expect(stillPending.body.steps.find((s: any) => s.id === registrationStep.id).status).toBe('PENDING');
    });

    it('notifies the citizen who owns the parcel when their step is decided', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);
      const landRecordsStep = created.body.steps.find((s: any) => s.department === 'LAND_RECORDS');

      await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${landRecordsStep.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE', remarks: 'All documents verified' })
        .expect(200);

      const notifications = await notificationRepository.find({ where: { userId: citizenUserId, type: 'WORKFLOW_STEP_APPROVED' } });
      const forThisWorkflow = notifications.find((n) => n.workflowId === created.body.id);
      expect(forThisWorkflow).toBeTruthy();
      expect(forThisWorkflow!.message).toContain('All documents verified');
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
        .send({ action: 'APPROVE', remarks: 'Approved' })
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

  describe('LAND_CLAIM_REQUEST (docs/FRONTEND_UPGRADE_SPEC.md follow-up)', () => {
    it('is exempt from the association check - a citizen can file it for a parcel they are NOT yet linked to', async () => {
      const unclaimed = await parcelRepository.save({
        canonicalParcelId: 'WF-CLAIM-1', stateCode: 'KA', districtCode: 'BAN', localBodyCode: 'KALB001', areaSqM: 400, geometry: square(77.6, 12.95),
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', unassociatedCitizenAuth)
        .send({ parcelId: unclaimed.id, workflowType: 'LAND_CLAIM_REQUEST' })
        .expect(201);

      expect(res.body.steps).toHaveLength(1);
      expect(res.body.steps[0]).toEqual(
        expect.objectContaining({ department: 'LAND_RECORDS', assignedRole: 'LAND_RECORD_OFFICER', status: 'PENDING' }),
      );
      // No link exists yet - filing a claim doesn't grant access by itself.
      const link = await citizenParcelRepository.findOne({ where: { parcel: { id: unclaimed.id } } });
      expect(link).toBeNull();
    });

    it('rejects a claim on a parcel already linked to another citizen, with 409', async () => {
      // `parcel` is already linked to `citizenAuth`'s account (beforeAll).
      await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', unassociatedCitizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'LAND_CLAIM_REQUEST' })
        .expect(409);
    });

    it('approving the claim step creates the citizen_parcels link, so the parcel then appears in /parcels/mine', async () => {
      const unclaimed = await parcelRepository.save({
        canonicalParcelId: 'WF-CLAIM-2', stateCode: 'KA', districtCode: 'BAN', localBodyCode: 'KALB001', areaSqM: 410, geometry: square(77.61, 12.95),
      });
      const claimant = await createAuthenticatedUser(testingModule, 'CITIZEN');

      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', claimant.authHeader)
        .send({ parcelId: unclaimed.id, workflowType: 'LAND_CLAIM_REQUEST' })
        .expect(201);

      const approveRes = await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${created.body.steps[0].id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE', remarks: 'Papers verified' })
        .expect(200);
      expect(approveRes.body.currentStatus).toBe('APPROVED');

      const mineRes = await request(app.getHttpServer())
        .get('/api/v1/parcels/mine')
        .set('Authorization', claimant.authHeader)
        .expect(200);
      expect(mineRes.body.parcels.some((p: any) => p.id === unclaimed.id)).toBe(true);
    });

    it('re-checks for a conflict at review time, rejecting approval with 409 if the parcel became linked to someone else since filing', async () => {
      const unclaimed = await parcelRepository.save({
        canonicalParcelId: 'WF-CLAIM-3', stateCode: 'KA', districtCode: 'BAN', localBodyCode: 'KALB001', areaSqM: 420, geometry: square(77.62, 12.95),
      });
      const claimant = await createAuthenticatedUser(testingModule, 'CITIZEN');
      const someoneElse = await createAuthenticatedUser(testingModule, 'CITIZEN');

      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', claimant.authHeader)
        .send({ parcelId: unclaimed.id, workflowType: 'LAND_CLAIM_REQUEST' })
        .expect(201);

      // A conflict appears after filing but before review (e.g. another
      // claim was approved first, or - as simulated directly here - the
      // parcel got linked some other way in the meantime).
      await citizenParcelRepository.save({ citizen: someoneElse.user, parcel: unclaimed });

      await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${created.body.steps[0].id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE', remarks: 'Approved' })
        .expect(409);
    });
  });

  describe('DOCUMENT_VERIFICATION_REQUEST (docs/FRONTEND_UPGRADE_SPEC.md follow-up)', () => {
    it('requires the usual association check (not exempt like LAND_CLAIM_REQUEST) and routes to LAND_RECORDS', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', unassociatedCitizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'DOCUMENT_VERIFICATION_REQUEST' })
        .expect(403);

      const res = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'DOCUMENT_VERIFICATION_REQUEST' })
        .expect(201);

      expect(res.body.steps).toHaveLength(1);
      expect(res.body.steps[0].department).toBe('LAND_RECORDS');
    });

    it('approving the step creates a bare REGISTERED ParcelDocument when the parcel had none on file', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'DOCUMENT_VERIFICATION_REQUEST' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${created.body.steps[0].id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE', remarks: 'Approved' })
        .expect(200);

      const document = await parcelDocumentRepository.findOne({ where: { parcelId: parcel.id } });
      expect(document).toBeTruthy();
      expect(document!.registrationStatus).toBe('REGISTERED');
    });

    it('flips an existing UNREGISTERED ParcelDocument to REGISTERED on approval', async () => {
      await parcelDocumentRepository.save({
        parcelId: otherParcel.id, documentType: 'ROR_COPY', fileName: 'x.png', filePath: '', mimeType: 'image/png', registrationStatus: 'UNREGISTERED',
      });

      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: otherParcel.id, workflowType: 'DOCUMENT_VERIFICATION_REQUEST' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${created.body.steps[0].id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE', remarks: 'Approved' })
        .expect(200);

      const document = await parcelDocumentRepository.findOne({ where: { parcelId: otherParcel.id } });
      expect(document!.registrationStatus).toBe('REGISTERED');
    });
  });

  describe('Evidence upload on POST /api/v1/workflows (multipart, docs/FRONTEND_UPGRADE_SPEC.md follow-up)', () => {
    it('stores an uploaded document as workflow evidence and runs the pre-check against it', async () => {
      const claimant = await createAuthenticatedUser(testingModule, 'CITIZEN');
      const unclaimed = await parcelRepository.save({
        canonicalParcelId: 'WF-EVIDENCE-1', stateCode: 'KA', districtCode: 'BAN', localBodyCode: 'KALB001', areaSqM: 500, geometry: square(77.63, 12.95),
      });
      const image = await renderParcelDocumentImage({
        ownerName: claimant.user.name, surveyNumber: 'N/A', areaSqM: 500, stateCode: 'KA', districtCode: 'BAN', registrationStatus: 'UNREGISTERED',
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', claimant.authHeader)
        .field('parcelId', unclaimed.id)
        .field('workflowType', 'LAND_CLAIM_REQUEST')
        .attach('document', image, 'document.png')
        .expect(201);

      expect(res.body.evidenceFileName).toBeTruthy();
      expect(res.body.evidenceFilePath).toBeTruthy();
      expect(res.body.evidenceMimeType).toBe('image/png');
      const precheck = JSON.parse(res.body.verificationPrecheck);
      expect(precheck.verdict).toBe('MATCHED');
      expect(precheck.checks.find((c: any) => c.field === 'OWNER_NAME').status).toBe('MATCHED');
    });

    it("approving promotes the workflow's evidence into the parcel's ParcelDocument, overwriting whatever was there", async () => {
      const claimant = await createAuthenticatedUser(testingModule, 'CITIZEN');
      const unclaimed = await parcelRepository.save({
        canonicalParcelId: 'WF-EVIDENCE-2', stateCode: 'KA', districtCode: 'BAN', localBodyCode: 'KALB001', areaSqM: 500, geometry: square(77.64, 12.95),
      });
      await parcelDocumentRepository.save({
        parcelId: unclaimed.id, documentType: 'ROR_COPY', fileName: 'stale.png', filePath: '', mimeType: 'image/png',
        extractedText: 'stale unrelated text', registrationStatus: 'UNREGISTERED',
      });
      const image = await renderParcelDocumentImage({
        ownerName: claimant.user.name, surveyNumber: 'N/A', areaSqM: 500, stateCode: 'KA', districtCode: 'BAN', registrationStatus: 'UNREGISTERED',
      });

      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', claimant.authHeader)
        .field('parcelId', unclaimed.id)
        .field('workflowType', 'LAND_CLAIM_REQUEST')
        .attach('document', image, 'document.png')
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${created.body.steps[0].id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE', remarks: 'Approved' })
        .expect(200);

      const document = await parcelDocumentRepository.findOne({ where: { parcelId: unclaimed.id } });
      expect(document!.registrationStatus).toBe('REGISTERED');
      expect(document!.fileName).not.toBe('stale.png');
      expect(document!.extractedText).toContain(claimant.user.name);
    });

    it('a plain JSON request (no file attached) still works exactly as before', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);

      expect(res.body.evidenceFileName).toBeNull();
      expect(res.body.evidenceFilePath).toBeNull();
    });
  });

  describe('POST /api/v1/workflows/:workflowId/steps/:stepId/escalate (Admin "alert the officers" oversight action)', () => {
    it('ADMIN can notify the officer holding a pending step without deciding it', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);
      const landRecordsStep = created.body.steps.find((s: any) => s.department === 'LAND_RECORDS');

      const res = await request(app.getHttpServer())
        .post(`/api/v1/workflows/${created.body.id}/steps/${landRecordsStep.id}/escalate`)
        .set('Authorization', adminAuth)
        .send({ message: 'This one looks stale, please check it today.' })
        .expect(201);

      // The step itself is untouched - escalating is not deciding it.
      const untouchedStep = res.body.steps.find((s: any) => s.id === landRecordsStep.id);
      expect(untouchedStep.status).toBe('PENDING');
      expect(untouchedStep.action).toBeNull();

      const notifications = await notificationRepository.find({ where: { userId: landRecordsOfficerId, type: 'ADMIN_ESCALATION' } });
      const forThisWorkflow = notifications.find((n) => n.workflowId === created.body.id);
      expect(forThisWorkflow).toBeTruthy();
      expect(forThisWorkflow!.parcelId).toBe(parcel.id);
      expect(forThisWorkflow!.message).toBe('This one looks stale, please check it today.');
    });

    it('rejects escalating an already-decided step with 400', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);
      const step = created.body.steps[0];

      await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${step.id}`)
        .set('Authorization', landRecordsAuth)
        .send({ action: 'APPROVE', remarks: 'Approved' })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/v1/workflows/${created.body.id}/steps/${step.id}/escalate`)
        .set('Authorization', adminAuth)
        .send({ message: 'Too late, already decided' })
        .expect(400);
    });

    it('rejects a missing message with 400', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);
      const step = created.body.steps[0];

      await request(app.getHttpServer())
        .post(`/api/v1/workflows/${created.body.id}/steps/${step.id}/escalate`)
        .set('Authorization', adminAuth)
        .send({})
        .expect(400);
    });

    it('returns 404 for an unknown workflow', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/workflows/00000000-0000-0000-0000-000000000000/steps/00000000-0000-0000-0000-000000000000/escalate')
        .set('Authorization', adminAuth)
        .send({ message: 'Please check' })
        .expect(404);
    });

    it('rejects escalation from a non-ADMIN officer with 403', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);
      const step = created.body.steps[0];

      await request(app.getHttpServer())
        .post(`/api/v1/workflows/${created.body.id}/steps/${step.id}/escalate`)
        .set('Authorization', landRecordsAuth)
        .send({ message: 'Please check' })
        .expect(403);
    });
  });

  describe('DISPUTE_FILING association exemption + conflict->dispute flow (docs/FRONTEND_UPGRADE_SPEC.md follow-up)', () => {
    it('is exempt from the association check - a citizen can file a dispute against a parcel that is not theirs', async () => {
      // `parcel` is linked to `citizenAuth`'s account, not `unassociatedCitizenAuth`'s.
      const res = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', unassociatedCitizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'DISPUTE_FILING', requestDetails: 'I believe this parcel is actually mine.' })
        .expect(201);

      expect(res.body.steps).toHaveLength(1);
      expect(res.body.steps[0].department).toBe('DISPUTE');
    });

    it("lets a citizen file a Dispute for a parcel their own Land Claim just conflicted on, carrying the same evidence", async () => {
      const disputer = await createAuthenticatedUser(testingModule, 'CITIZEN');
      const image = await renderParcelDocumentImage({
        ownerName: disputer.user.name, surveyNumber: 'N/A', areaSqM: 500, stateCode: 'MH', districtCode: 'PUN', registrationStatus: 'UNREGISTERED',
      });

      // `parcel` is already linked to `citizenAuth` - the claim conflicts.
      await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', disputer.authHeader)
        .field('parcelId', parcel.id)
        .field('workflowType', 'LAND_CLAIM_REQUEST')
        .attach('document', image, 'document.png')
        .expect(409);

      // The pointer actually works now: filing a dispute for that same
      // parcel, with the same evidence, succeeds rather than 403ing.
      const disputeRes = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', disputer.authHeader)
        .field('parcelId', parcel.id)
        .field('workflowType', 'DISPUTE_FILING')
        .field('requestDetails', 'This parcel is linked to another account, but I believe it is mine.')
        .attach('document', image, 'document.png')
        .expect(201);

      expect(disputeRes.body.evidenceFileName).toBeTruthy();
    });

    it("never promotes a Dispute Filing's evidence into the parcel's ParcelDocument, even on approval", async () => {
      const disputer = await createAuthenticatedUser(testingModule, 'CITIZEN');
      const freshParcel = await parcelRepository.save({
        canonicalParcelId: 'WF-DISPUTE-NOPROMOTE', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 500, geometry: square(73.86, 18.52),
      });
      const image = await renderParcelDocumentImage({
        ownerName: disputer.user.name, surveyNumber: 'N/A', areaSqM: 500, stateCode: 'MH', districtCode: 'PUN', registrationStatus: 'UNREGISTERED',
      });

      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', disputer.authHeader)
        .field('parcelId', freshParcel.id)
        .field('workflowType', 'DISPUTE_FILING')
        .attach('document', image, 'document.png')
        .expect(201);
      expect(created.body.verificationPrecheck).toBeNull();

      const disputeOfficerAuth = (await createAuthenticatedUser(testingModule, 'DISPUTE_OFFICER')).authHeader;
      await request(app.getHttpServer())
        .patch(`/api/v1/workflows/${created.body.id}/steps/${created.body.steps[0].id}`)
        .set('Authorization', disputeOfficerAuth)
        .send({ action: 'APPROVE', remarks: 'Approved' })
        .expect(200);

      const document = await parcelDocumentRepository.findOne({ where: { parcelId: freshParcel.id } });
      // freshParcel never had a ParcelDocument - a Dispute Filing's approval
      // must never create/flip one, unlike a Land Claim's.
      expect(document).toBeNull();
    });
  });

  describe('GET /api/v1/workflows/:id/evidence', () => {
    it("serves a workflow's submitted evidence file to staff", async () => {
      const image = await renderParcelDocumentImage({
        ownerName: 'Evidence Test', surveyNumber: 'N/A', areaSqM: 500, stateCode: 'MH', districtCode: 'PUN', registrationStatus: 'UNREGISTERED',
      });
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .field('parcelId', parcel.id)
        .field('workflowType', 'CORRECTION_REQUEST')
        .attach('document', image, 'document.png')
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/workflows/${created.body.id}/evidence`)
        .set('Authorization', adminAuth)
        .expect(200);
      expect(res.headers['content-type']).toBe('image/png');
    });

    it('returns 404 when the workflow carries no evidence', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', citizenAuth)
        .send({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST' })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/api/v1/workflows/${created.body.id}/evidence`)
        .set('Authorization', adminAuth)
        .expect(404);
    });

    it('rejects a citizen account with 403', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/workflows/00000000-0000-0000-0000-000000000000/evidence')
        .set('Authorization', citizenAuth)
        .expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/workflows/00000000-0000-0000-0000-000000000000/evidence').expect(401);
    });
  });
});
