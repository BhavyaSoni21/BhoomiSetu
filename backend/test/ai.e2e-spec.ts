process.env.USE_SQLITE = 'true';
process.env.SQLITE_PATH = ':memory:';
process.env.GROQ_API_KEY = 'test-key';

import { INestApplication, ServiceUnavailableException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request = require('supertest');
import OpenAI from 'openai';
import { AppModule } from '../src/app.module';
import { Parcel } from '../src/parcels/parcel.entity';
import { CitizenParcel } from '../src/parcels/citizen-parcel.entity';
import { TaxRecord } from '../src/departments/tax-record.entity';
import { GovernanceAlert } from '../src/governance/governance-alert.entity';
import { GroqService } from '../src/ai/groq.service';
import { createAuthenticatedUser } from './helpers/auth';

// The `openai` SDK is mocked for this whole file - these tests exercise
// AiService's query-filtering and Zod-validation logic against a
// controllable fake model response, never a real Groq API call.
jest.mock('openai');
const mockCreate = jest.fn();
(OpenAI as unknown as jest.Mock).mockImplementation(() => ({
  chat: { completions: { create: mockCreate } },
}));

function mockGroqResponds(json: unknown) {
  mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(json) } }] });
}

const square = (minLng: number, minLat: number, size = 0.001) =>
  JSON.stringify({
    type: 'Polygon',
    coordinates: [[
      [minLng, minLat], [minLng + size, minLat], [minLng + size, minLat + size], [minLng, minLat + size], [minLng, minLat],
    ]],
  });

describe('GroqService configuration', () => {
  it('rejects when GROQ_API_KEY is not set, without making any network call', async () => {
    const previous = process.env.GROQ_API_KEY;
    const previousGemini = process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      // GeminiService also needs no key for this test - both providers absent
      // means completeJson() throws ServiceUnavailableException as expected.
      const { GeminiService } = await import('../src/ai/gemini.service');
      const geminiStub = new GeminiService();
      const svc = new GroqService(geminiStub);
      await expect(svc.completeJson('system', 'user')).rejects.toThrow(ServiceUnavailableException);
      expect(mockCreate).not.toHaveBeenCalled();
    } finally {
      process.env.GROQ_API_KEY = previous;
      if (previousGemini !== undefined) process.env.GEMINI_API_KEY = previousGemini;
    }
  });
});

describe('AI (e2e)', () => {
  let app: INestApplication;
  let parcelRepository: Repository<Parcel>;
  let taxRepository: Repository<TaxRecord>;
  let alertRepository: Repository<GovernanceAlert>;
  let parcel: Parcel;
  let overdueParcel: Parcel;
  let alert: GovernanceAlert;
  // Only POST /ai/alerts/:alertId/explain is officer/admin-only
  // (docs/FEATURE_AUDIT.md §8 item 5) - /query and /parcels/:id/explain stay
  // public (citizen-facing touchpoints); "explain" additionally withholds
  // owner-only department data from a non-owner viewer, same as GET
  // /parcels/:id/360 - see the citizen-association fixtures below.
  let officerAuth: string;
  let ownerCitizenAuth: string;
  let otherCitizenAuth: string;

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
    alertRepository = moduleFixture.get(getRepositoryToken(GovernanceAlert));

    parcel = await parcelRepository.save({
      canonicalParcelId: 'AI-1', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 500, geometry: square(73.85, 18.52),
    });
    overdueParcel = await parcelRepository.save({
      canonicalParcelId: 'AI-2', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 400, geometry: square(73.86, 18.53),
    });
    await taxRepository.save({ parcelId: parcel.id, assessedValue: 100000, annualTaxAmount: 500, taxStatus: 'PAID', outstandingAmount: 0 });
    await taxRepository.save({ parcelId: overdueParcel.id, assessedValue: 80000, annualTaxAmount: 400, taxStatus: 'OVERDUE', outstandingAmount: 400 });

    alert = await alertRepository.save({
      parcelId: parcel.id, alertType: 'TAX_OVERDUE', severity: 'LOW', source: 'TAX_MONITOR', status: 'OPEN',
      explanation: 'Outstanding property tax of 400 is overdue for this parcel.',
    });

    officerAuth = (await createAuthenticatedUser(moduleFixture, 'LAND_RECORD_OFFICER')).authHeader;

    const citizenParcelRepository: Repository<CitizenParcel> = moduleFixture.get(getRepositoryToken(CitizenParcel));
    const ownerCitizen = await createAuthenticatedUser(moduleFixture, 'CITIZEN');
    ownerCitizenAuth = ownerCitizen.authHeader;
    await citizenParcelRepository.save({ citizen: ownerCitizen.user, parcel });
    otherCitizenAuth = (await createAuthenticatedUser(moduleFixture, 'CITIZEN')).authHeader;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockCreate.mockReset();
  });

  describe('POST /api/v1/ai/query', () => {
    it('executes the actual DB query using the AI-derived filters for a DATA_QUERY intent', async () => {
      mockGroqResponds({ intent: 'DATA_QUERY', reply: 'Here are the overdue-tax parcels.', filters: { tax_status: 'OVERDUE' } });

      const res = await request(app.getHttpServer())
        .post('/api/v1/ai/query')
        .send({ query: 'Show me parcels with overdue tax' })
        .expect(201);

      expect(res.body.intent).toBe('DATA_QUERY');
      expect(res.body.reply).toBe('Here are the overdue-tax parcels.');
      expect(res.body.filters).toEqual({ tax_status: 'OVERDUE' });
      const resultIds = res.body.results.map((p: any) => p.id);
      expect(resultIds).toContain(overdueParcel.id);
      expect(resultIds).not.toContain(parcel.id);
    });

    it('silently strips a filter key the AI hallucinated that is not in the schema', async () => {
      mockGroqResponds({ intent: 'DATA_QUERY', reply: 'Here you go.', filters: { tax_status: 'PAID', made_up_field: 'anything' } });

      const res = await request(app.getHttpServer())
        .post('/api/v1/ai/query')
        .send({ query: 'Show me parcels with paid tax' })
        .expect(201);

      expect(res.body.filters).toEqual({ tax_status: 'PAID' });
      expect(res.body.results.map((p: any) => p.id)).toContain(parcel.id);
    });

    it('answers a HELP-intent question with just a reply and no database query', async () => {
      mockGroqResponds({ intent: 'HELP', reply: 'Use the Search Parcels panel and enter a ULPIN or Survey Number.' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/ai/query')
        .send({ query: 'How do I search for a parcel?' })
        .expect(201);

      expect(res.body).toEqual({ intent: 'HELP', reply: 'Use the Search Parcels panel and enter a ULPIN or Survey Number.' });
    });

    it('treats a DATA_QUERY with no filters at all as a HELP-shaped reply (no results/filters keys)', async () => {
      mockGroqResponds({ intent: 'DATA_QUERY', reply: 'Could you say which parcels you mean?' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/ai/query')
        .send({ query: 'show me some parcels' })
        .expect(201);

      expect(res.body).toEqual({ intent: 'HELP', reply: 'Could you say which parcels you mean?' });
    });

    it('rejects with 502 when the AI response has an invalid enum value', async () => {
      mockGroqResponds({ intent: 'DATA_QUERY', reply: 'x', filters: { tax_status: 'MAYBE_OVERDUE' } });

      await request(app.getHttpServer()).post('/api/v1/ai/query').send({ query: 'anything' }).expect(502);
    });

    it('rejects with 502 when the AI response is missing the intent/reply keys entirely', async () => {
      mockGroqResponds({ notIntent: {} });

      await request(app.getHttpServer()).post('/api/v1/ai/query').send({ query: 'anything' }).expect(502);
    });

    it('rejects a request with an empty query with 400', async () => {
      await request(app.getHttpServer()).post('/api/v1/ai/query').send({ query: '' }).expect(400);
      await request(app.getHttpServer()).post('/api/v1/ai/query').send({}).expect(400);
    });

    it('normalizes a human-phrased state/district (e.g. "Maharashtra"/"Pune") to the stored short codes', async () => {
      mockGroqResponds({ intent: 'DATA_QUERY', reply: 'Here you go.', filters: { state: 'Maharashtra', district: 'Pune' } });

      const res = await request(app.getHttpServer())
        .post('/api/v1/ai/query')
        .send({ query: 'Show me parcels in Pune, Maharashtra' })
        .expect(201);

      expect(res.body.results.map((p: any) => p.id)).toEqual(expect.arrayContaining([parcel.id, overdueParcel.id]));
      expect(res.body.results.every((p: any) => p.stateCode === 'MH' && p.districtCode === 'PUN')).toBe(true);
    });
  });

  describe('POST /api/v1/ai/parcels/:parcelId/explain', () => {
    it('returns a validated structured explanation for a real parcel', async () => {
      mockGroqResponds({
        summary: 'This parcel has registration and tax data on file.',
        risk_level: 'LOW',
        findings: [{ type: 'TAX', description: 'Tax is paid in full.' }],
        recommended_action: 'No action needed.',
      });

      const res = await request(app.getHttpServer()).post(`/api/v1/ai/parcels/${parcel.id}/explain`).expect(201);
      expect(res.body.risk_level).toBe('LOW');
      expect(res.body.findings).toHaveLength(1);
    });

    it('returns 404 for an unknown parcel (without calling the AI at all)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/ai/parcels/00000000-0000-0000-0000-000000000000/explain')
        .expect(404);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('rejects a non-UUID id with 400', async () => {
      await request(app.getHttpServer()).post('/api/v1/ai/parcels/not-a-uuid/explain').expect(400);
    });

    it('rejects with 502 when the AI omits a required field', async () => {
      mockGroqResponds({ summary: 'Missing risk level and the rest' });

      await request(app.getHttpServer()).post(`/api/v1/ai/parcels/${parcel.id}/explain`).expect(502);
    });

    // Same withholding rule as GET /parcels/:id/360 (parcels.controller.ts) -
    // "Explain with AI" must never be a side channel for data the 360 view
    // itself hides from a non-owner viewer.
    function stubExplanation() {
      mockGroqResponds({ summary: 'x', risk_level: 'LOW', findings: [], recommended_action: 'None.' });
    }

    function sentParcel360(): any {
      return JSON.parse(mockCreate.mock.calls[0][0].messages[1].content);
    }

    it('withholds Tax (and the other owner-only departments) from the data sent to the AI for an anonymous caller', async () => {
      stubExplanation();
      await request(app.getHttpServer()).post(`/api/v1/ai/parcels/${parcel.id}/explain`).expect(201);

      expect(sentParcel360().departments.tax).toBeNull();
    });

    it('withholds Tax from the data sent to the AI for a citizen who does not own this parcel', async () => {
      stubExplanation();
      await request(app.getHttpServer())
        .post(`/api/v1/ai/parcels/${parcel.id}/explain`)
        .set('Authorization', otherCitizenAuth)
        .expect(201);

      expect(sentParcel360().departments.tax).toBeNull();
    });

    it('includes the real Tax data for the citizen this parcel is associated with', async () => {
      stubExplanation();
      await request(app.getHttpServer())
        .post(`/api/v1/ai/parcels/${parcel.id}/explain`)
        .set('Authorization', ownerCitizenAuth)
        .expect(201);

      expect(sentParcel360().departments.tax.taxStatus).toBe('PAID');
    });

    it('includes the real Tax data for staff, regardless of association', async () => {
      stubExplanation();
      await request(app.getHttpServer())
        .post(`/api/v1/ai/parcels/${parcel.id}/explain`)
        .set('Authorization', officerAuth)
        .expect(201);

      expect(sentParcel360().departments.tax.taxStatus).toBe('PAID');
    });
  });

  describe('POST /api/v1/ai/alerts/:alertId/explain', () => {
    it('returns a validated structured explanation for a real alert', async () => {
      mockGroqResponds({
        summary: 'Property tax is overdue for this parcel.',
        risk_level: 'MEDIUM',
        findings: [{ type: 'TAX_OVERDUE', description: 'Outstanding balance of 400.' }],
        recommended_action: 'OFFICER_REVIEW',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/ai/alerts/${alert.id}/explain`)
        .set('Authorization', officerAuth)
        .expect(201);
      expect(res.body.risk_level).toBe('MEDIUM');
      expect(res.body.recommended_action).toBe('OFFICER_REVIEW');
    });

    it('returns 404 for an unknown alert (without calling the AI at all)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/ai/alerts/00000000-0000-0000-0000-000000000000/explain')
        .set('Authorization', officerAuth)
        .expect(404);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('rejects with 502 when the AI response has an invalid risk_level', async () => {
      mockGroqResponds({ summary: 'x', risk_level: 'EXTREME', findings: [], recommended_action: 'x' });

      await request(app.getHttpServer())
        .post(`/api/v1/ai/alerts/${alert.id}/explain`)
        .set('Authorization', officerAuth)
        .expect(502);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).post(`/api/v1/ai/alerts/${alert.id}/explain`).expect(401);
    });
  });
});
