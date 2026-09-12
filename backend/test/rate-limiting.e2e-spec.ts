process.env.USE_SQLITE = 'true';
process.env.SQLITE_PATH = ':memory:';

import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import request = require('supertest');
import { AppModule } from '../src/app.module';

// A tiny standalone module wired the exact same way AppModule wires
// ThrottlerModule/APP_GUARD (see app.module.ts), just with a limit low
// enough to deterministically trip in a handful of requests rather than
// needing to fire 200+ real requests to prove the production config works.
@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { ok: true };
  }
}

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 3 }])],
  controllers: [PingController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class ThrottleMechanismModule {}

describe('Rate limiting (e2e)', () => {
  describe('the ThrottlerGuard mechanism (as wired in AppModule)', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [ThrottleMechanismModule],
      }).compile();
      app = moduleFixture.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('allows requests up to the limit and rejects the one that exceeds it with 429', async () => {
      await request(app.getHttpServer()).get('/ping').expect(200);
      await request(app.getHttpServer()).get('/ping').expect(200);
      await request(app.getHttpServer()).get('/ping').expect(200);
      await request(app.getHttpServer()).get('/ping').expect(429);
    });
  });

  describe('the real app (generous default limit)', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleFixture.createNestApplication();
      app.setGlobalPrefix('api/v1');
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('does not block normal usage - 10 rapid requests all succeed', async () => {
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer()).get('/api/v1/parcels?state=MH').expect(200);
      }
    });
  });
});
