process.env.USE_SQLITE = 'true';
process.env.SQLITE_PATH = ':memory:';

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';

// KNOWN_RISKS.md MED-7: a dedicated, unauthenticated, un-prefixed path for
// infra to poll (main.ts mounts this outside the /api/v1 prefix, unlike
// every other route in this app).
describe('GET /health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responds ok with no authentication and no /api/v1 prefix', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('is not reachable under the /api/v1 prefix', async () => {
    await request(app.getHttpServer()).get('/api/v1/health').expect(404);
  });
});
