process.env.USE_SQLITE = 'true';
process.env.SQLITE_PATH = ':memory:';

import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { requestIdMiddleware } from '../src/common/request-id.middleware';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

// A genuinely unexpected (non-HttpException) error - nothing in the real
// app is a reliable, side-effect-free way to force one, so this stands in
// for "some code threw a plain Error" the same way a real bug would.
@Controller('test-throw')
class ThrowingTestController {
  @Get()
  boom(): never {
    throw new Error('a genuinely unexpected failure, with a stack trace that must never reach the client');
  }
}

// KNOWN_RISKS.md MED-8. Builds the app the same way main.ts's bootstrap()
// does (request-id middleware + the global exception filter) rather than
// the bare Test.createTestingModule().compile() + app.init() every other
// e2e spec uses - those boot-time pieces are main.ts-only and wouldn't
// otherwise be exercised at all (same precedent as health.e2e-spec.ts
// replicating setGlobalPrefix's exclude option).
describe('Global error handling (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ThrowingTestController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(requestIdMiddleware);
    app.useGlobalFilters(new AllExceptionsFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'test-throw'] });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('stamps a fresh X-Request-Id on a normal successful response', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('honors a caller-supplied X-Request-Id instead of minting a new one', async () => {
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('X-Request-Id', 'caller-supplied-id-123')
      .expect(200);
    expect(res.headers['x-request-id']).toBe('caller-supplied-id-123');
  });

  it('preserves a thrown HttpException\'s status/message and adds requestId', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/workflows/00000000-0000-0000-0000-000000000000')
      .expect(401); // no auth header - JwtAuthGuard rejects before the route body runs

    expect(res.body).toMatchObject({ statusCode: 401 });
    expect(typeof res.body.requestId).toBe('string');
    expect(res.headers['x-request-id']).toBe(res.body.requestId);
  });

  it('turns an unhandled exception into a generic 500 with no stack trace leaked, plus requestId', async () => {
    const res = await request(app.getHttpServer()).get('/test-throw').expect(500);

    expect(res.body).toEqual({ statusCode: 500, message: 'Internal server error', requestId: expect.any(String) });
    expect(JSON.stringify(res.body)).not.toContain('a genuinely unexpected failure');
    expect(res.headers['x-request-id']).toBe(res.body.requestId);
  });
});
