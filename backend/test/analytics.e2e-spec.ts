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
import { RegistrationRecord } from '../src/departments/registration-record.entity';
import { PlanningRecord } from '../src/departments/planning-record.entity';
import { DisputeRecord } from '../src/departments/dispute-record.entity';
import { Workflow } from '../src/workflows/workflow.entity';
import { WorkflowStep } from '../src/workflows/workflow-step.entity';
import { GovernanceAlert } from '../src/governance/governance-alert.entity';
import { AuditLog } from '../src/audit/audit-log.entity';
import { User } from '../src/users/user.entity';
import * as bcrypt from 'bcryptjs';
import { createAuthenticatedUser } from './helpers/auth';

const square = (minLng: number, minLat: number, size = 0.001) =>
  JSON.stringify({
    type: 'Polygon',
    coordinates: [[
      [minLng, minLat], [minLng + size, minLat], [minLng + size, minLat + size], [minLng, minLat + size], [minLng, minLat],
    ]],
  });

describe('Analytics (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let parcelRepository: Repository<Parcel>;
  let taxRepository: Repository<TaxRecord>;
  let registrationRepository: Repository<RegistrationRecord>;
  let planningRepository: Repository<PlanningRecord>;
  let disputeRepository: Repository<DisputeRecord>;
  let workflowRepository: Repository<Workflow>;
  let workflowStepRepository: Repository<WorkflowStep>;
  let alertRepository: Repository<GovernanceAlert>;
  let auditLogRepository: Repository<AuditLog>;
  let userRepository: Repository<User>;
  // Admin-only (docs/FEATURE_AUDIT.md §8 item 5).
  let adminAuth: string;
  let officerAuth: string;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();

    parcelRepository = moduleFixture.get(getRepositoryToken(Parcel));
    taxRepository = moduleFixture.get(getRepositoryToken(TaxRecord));
    registrationRepository = moduleFixture.get(getRepositoryToken(RegistrationRecord));
    planningRepository = moduleFixture.get(getRepositoryToken(PlanningRecord));
    disputeRepository = moduleFixture.get(getRepositoryToken(DisputeRecord));
    workflowRepository = moduleFixture.get(getRepositoryToken(Workflow));
    workflowStepRepository = moduleFixture.get(getRepositoryToken(WorkflowStep));
    alertRepository = moduleFixture.get(getRepositoryToken(GovernanceAlert));
    auditLogRepository = moduleFixture.get(getRepositoryToken(AuditLog));
    userRepository = moduleFixture.get(getRepositoryToken(User));

    const parcels = await Promise.all([
      parcelRepository.save({ canonicalParcelId: 'AN-1', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 100, geometry: square(73.85, 18.52) }),
      parcelRepository.save({ canonicalParcelId: 'AN-2', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 100, geometry: square(73.86, 18.53) }),
      parcelRepository.save({ canonicalParcelId: 'AN-3', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 100, geometry: square(73.87, 18.54) }),
    ]);

    await taxRepository.save([
      { parcelId: parcels[0].id, assessedValue: 1000, annualTaxAmount: 10, taxStatus: 'PAID', outstandingAmount: 0 },
      { parcelId: parcels[1].id, assessedValue: 1000, annualTaxAmount: 10, taxStatus: 'OVERDUE', outstandingAmount: 10 },
      { parcelId: parcels[2].id, assessedValue: 1000, annualTaxAmount: 10, taxStatus: 'OVERDUE', outstandingAmount: 10 },
    ]);
    await registrationRepository.save([
      { parcelId: parcels[0].id, registrationStatus: 'REGISTERED' },
      { parcelId: parcels[1].id, registrationStatus: 'NOT_REGISTERED' },
    ]);
    await planningRepository.save([
      { parcelId: parcels[0].id, landUse: 'RESIDENTIAL', zoningClassification: 'R-1', masterPlanReference: 'Test Plan', buildingPermissionStatus: 'APPROVED' },
      { parcelId: parcels[1].id, landUse: 'RESIDENTIAL', zoningClassification: 'R-1', masterPlanReference: 'Test Plan', buildingPermissionStatus: 'APPROVED' },
      { parcelId: parcels[2].id, landUse: 'COMMERCIAL', zoningClassification: 'C-1', masterPlanReference: 'Test Plan', buildingPermissionStatus: 'APPROVED' },
    ]);
    await disputeRepository.save([
      { parcelId: parcels[0].id, hasActiveDispute: true, caseStatus: 'UNDER_REVIEW' },
      { parcelId: parcels[1].id, hasActiveDispute: false, caseStatus: null },
    ]);
    await workflowRepository.save([
      { parcelId: parcels[0].id, workflowType: 'ROR_COPY_REQUEST', currentStatus: 'SUBMITTED' },
      { parcelId: parcels[0].id, workflowType: 'ROR_COPY_REQUEST', currentStatus: 'APPROVED' },
      { parcelId: parcels[1].id, workflowType: 'CORRECTION_REQUEST', currentStatus: 'SUBMITTED' },
    ]);
    await alertRepository.save([
      { parcelId: parcels[0].id, alertType: 'TAX_OVERDUE', severity: 'LOW', source: 'TAX_MONITOR', status: 'OPEN', explanation: 'x' },
      { parcelId: parcels[1].id, alertType: 'TAX_OVERDUE', severity: 'LOW', source: 'TAX_MONITOR', status: 'OPEN', explanation: 'x' },
      { parcelId: parcels[2].id, alertType: 'UNAUTHORIZED_CHANGE_DETECTED', severity: 'HIGH', source: 'CHANGE_DETECTION', status: 'DISMISSED', explanation: 'x' },
    ]);

    adminAuth = (await createAuthenticatedUser(moduleFixture, 'ADMIN')).authHeader;
    officerAuth = (await createAuthenticatedUser(moduleFixture, 'LAND_RECORD_OFFICER')).authHeader;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/analytics/summary', () => {
    it('returns correct totals', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/summary')
        .set('Authorization', adminAuth)
        .expect(200);
      expect(res.body.totals.parcels).toBe(3);
      expect(res.body.totals.workflows).toBe(3);
      expect(res.body.totals.openAlerts).toBe(2); // 2 OPEN, 1 DISMISSED
      expect(res.body.totals.activeDisputes).toBe(1);
      // adminAuth + officerAuth were both minted directly via the test JWT
      // helper (no real POST /auth/login call), so both exist as real users
      // but neither produced an AUTH_LOGIN audit entry.
      expect(res.body.totals.totalUsers).toBeGreaterThanOrEqual(2);
      expect(res.body.totals.recentLogins24h).toBe(0);
    });

    it('returns a correct tax status distribution', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/summary')
        .set('Authorization', adminAuth)
        .expect(200);
      const byKey = Object.fromEntries(res.body.taxStatusDistribution.map((d: any) => [d.key, d.count]));
      expect(byKey.PAID).toBe(1);
      expect(byKey.OVERDUE).toBe(2);
    });

    it('returns a correct workflow status distribution', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/summary')
        .set('Authorization', adminAuth)
        .expect(200);
      const byKey = Object.fromEntries(res.body.workflowStatusDistribution.map((d: any) => [d.key, d.count]));
      expect(byKey.SUBMITTED).toBe(2);
      expect(byKey.APPROVED).toBe(1);
    });

    it('returns a correct alert severity distribution', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/summary')
        .set('Authorization', adminAuth)
        .expect(200);
      const byKey = Object.fromEntries(res.body.alertSeverityDistribution.map((d: any) => [d.key, d.count]));
      expect(byKey.LOW).toBe(2);
      expect(byKey.HIGH).toBe(1);
    });

    it('returns a correct land use and dispute case status distribution', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/summary')
        .set('Authorization', adminAuth)
        .expect(200);
      const landUse = Object.fromEntries(res.body.landUseDistribution.map((d: any) => [d.key, d.count]));
      expect(landUse.RESIDENTIAL).toBe(2);
      expect(landUse.COMMERCIAL).toBe(1);

      const disputeStatus = Object.fromEntries(res.body.disputeCaseStatusDistribution.map((d: any) => [d.key, d.count]));
      expect(disputeStatus.UNDER_REVIEW).toBe(1);
      // The null-caseStatus dispute record is excluded (grouping filters IS NOT NULL).
      expect(Object.values(disputeStatus).reduce((a: number, b: any) => a + b, 0)).toBe(1);
    });

    it('increments recentLogins24h after a real POST /auth/login', async () => {
      await userRepository.save({
        email: 'login-count-test@test.gov.in', passwordHash: bcrypt.hashSync('CorrectPass1', 10), name: 'Login Count Test', role: 'PLANNING_OFFICER',
      });

      const before = await request(app.getHttpServer()).get('/api/v1/analytics/summary').set('Authorization', adminAuth).expect(200);

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'login-count-test@test.gov.in', password: 'CorrectPass1' })
        .expect(201);

      const after = await request(app.getHttpServer()).get('/api/v1/analytics/summary').set('Authorization', adminAuth).expect(200);
      expect(after.body.totals.recentLogins24h).toBe(before.body.totals.recentLogins24h + 1);
    });

    it('does not count citizen sign-in accounts toward totalUsers', async () => {
      const before = await request(app.getHttpServer()).get('/api/v1/analytics/summary').set('Authorization', adminAuth).expect(200);

      await userRepository.save({ email: 'citizen-metric-test@test.com', passwordHash: 'x', name: 'A Citizen', role: 'CITIZEN' });

      const after = await request(app.getHttpServer()).get('/api/v1/analytics/summary').set('Authorization', adminAuth).expect(200);
      expect(after.body.totals.totalUsers).toBe(before.body.totals.totalUsers);
    });

    it('rejects a non-admin officer with 403', async () => {
      await request(app.getHttpServer()).get('/api/v1/analytics/summary').set('Authorization', officerAuth).expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/analytics/summary').expect(401);
    });
  });

  describe('GET /api/v1/analytics/officer-monitoring', () => {
    it('lists every officer, including ones with zero activity (all zeros/null, not omitted)', async () => {
      const idleOfficer = await createAuthenticatedUser(moduleFixture, 'ENCUMBRANCE_OFFICER');

      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/officer-monitoring')
        .set('Authorization', adminAuth)
        .expect(200);

      const entry = res.body.find((e: any) => e.userId === idleOfficer.user.id);
      expect(entry).toMatchObject({
        name: idleOfficer.user.name,
        role: 'ENCUMBRANCE_OFFICER',
        department: 'ENCUMBRANCE',
        pendingInRoleQueue: 0,
        approvedCount: 0,
        rejectedCount: 0,
        avgDecisionHours: null,
        lastActivityAt: null,
      });
    });

    it('reflects real pending WorkflowStep counts, grouped by role', async () => {
      const parcel = await parcelRepository.save({
        canonicalParcelId: 'AN-PENDING', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 100, geometry: square(73.9, 18.6),
      });
      const workflow = await workflowRepository.save({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST', currentStatus: 'SUBMITTED' });
      await workflowStepRepository.save([
        { workflow, stepOrder: 1, department: 'RESTRICTION', assignedRole: 'RESTRICTION_OFFICER', status: 'PENDING' },
        { workflow, stepOrder: 2, department: 'RESTRICTION', assignedRole: 'RESTRICTION_OFFICER', status: 'PENDING' },
      ]);
      const restrictionOfficer = await createAuthenticatedUser(moduleFixture, 'RESTRICTION_OFFICER');

      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/officer-monitoring')
        .set('Authorization', adminAuth)
        .expect(200);

      const entry = res.body.find((e: any) => e.userId === restrictionOfficer.user.id);
      expect(entry.pendingInRoleQueue).toBeGreaterThanOrEqual(2);
    });

    it('attributes decisions to the specific officer who made them (not their role generically), via AuditLog', async () => {
      const deciderOfficer = await createAuthenticatedUser(moduleFixture, 'PLANNING_OFFICER');
      const parcel = await parcelRepository.save({
        canonicalParcelId: 'AN-DECIDED', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 100, geometry: square(73.91, 18.61),
      });
      const workflow = await workflowRepository.save({ parcelId: parcel.id, workflowType: 'ROR_COPY_REQUEST', currentStatus: 'APPROVED' });

      await auditLogRepository.save([
        {
          userId: deciderOfficer.user.id, userRole: 'PLANNING_OFFICER', action: 'WORKFLOW_STEP_APPROVED',
          entityType: 'WORKFLOW_STEP', entityId: 'step-1', parcelId: parcel.id,
          metadata: JSON.stringify({ workflowId: workflow.id, department: 'PLANNING' }),
        },
        {
          userId: deciderOfficer.user.id, userRole: 'PLANNING_OFFICER', action: 'WORKFLOW_STEP_REJECTED',
          entityType: 'WORKFLOW_STEP', entityId: 'step-2', parcelId: parcel.id,
          metadata: JSON.stringify({ workflowId: workflow.id, department: 'PLANNING' }),
        },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/officer-monitoring')
        .set('Authorization', adminAuth)
        .expect(200);

      const entry = res.body.find((e: any) => e.userId === deciderOfficer.user.id);
      expect(entry.approvedCount).toBe(1);
      expect(entry.rejectedCount).toBe(1);
      expect(entry.avgDecisionHours).not.toBeNull();
      expect(typeof entry.avgDecisionHours).toBe('number');
      expect(entry.lastActivityAt).toBeTruthy();
    });

    it('rejects a non-admin officer with 403', async () => {
      await request(app.getHttpServer()).get('/api/v1/analytics/officer-monitoring').set('Authorization', officerAuth).expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/analytics/officer-monitoring').expect(401);
    });
  });
});
