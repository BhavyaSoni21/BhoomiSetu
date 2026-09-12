import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { isSqliteConfigured } from './database.config';
import { requestIdMiddleware } from './common/request-id.middleware';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  // Refuse to start with the publicly-known placeholder JWT secret once
  // actually deployed (NODE_ENV=production - see docker-compose.yml) -
  // anyone who knows 'change_this_in_production' could forge an admin
  // token. Local dev/test never set NODE_ENV=production, so this doesn't
  // change that experience at all, only a real deployment that forgot to
  // set a real JWT_SECRET.
  const insecureJwtDefault = 'change_this_in_production';
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === insecureJwtDefault)) {
    console.error(
      `Refusing to start: JWT_SECRET is unset or still the public placeholder value ('${insecureJwtDefault}') while NODE_ENV=production. ` +
        'Set a real, random JWT_SECRET in your deployment environment before starting the app.',
    );
    process.exit(1);
  }

  // KNOWN_RISKS.md MED-4: the Postgres branch of database.config.ts falls
  // back to 'postgres'/'postgres' when these are unset, rather than erroring -
  // fine for local dev (an unset DB_HOST means SQLite is used instead, see
  // isSqliteConfigured, so these defaults never even apply there), but a
  // real deployment silently running against guessable credentials is worth
  // refusing outright, same as the JWT_SECRET check above. docker-compose.yml
  // already sets all three explicitly (even though to the same 'postgres'
  // value) so this doesn't affect that path - only a deployment that forgot
  // to set them at all.
  if (process.env.NODE_ENV === 'production' && !isSqliteConfigured()) {
    const missing = ['DB_USERNAME', 'DB_PASSWORD', 'DB_NAME'].filter((key) => !process.env[key]);
    if (missing.length > 0) {
      console.error(
        `Refusing to start: ${missing.join(', ')} unset while NODE_ENV=production - the app would otherwise silently connect using ` +
          "the default 'postgres'/'postgres' credentials. Set these explicitly in your deployment environment before starting the app.",
      );
      process.exit(1);
    }
  }

  const app = await NestFactory.create(AppModule);

  // KNOWN_RISKS.md MED-3: no security-headers middleware existed anywhere
  // (missing CSP, X-Frame-Options, X-Content-Type-Options, HSTS, etc).
  // Content-Security-Policy is left off rather than tuned - Swagger UI
  // (mounted below, dev/non-prod only) needs inline scripts/styles that
  // helmet's default CSP blocks outright, and this is a JSON API otherwise
  // (nothing here serves app HTML for a CSP to actually protect). Every
  // other helmet default (frameguard, noSniff, HSTS, etc.) stays on.
  app.use(helmet({ contentSecurityPolicy: false }));

  // KNOWN_RISKS.md MED-8: stamps every request with a correlation id
  // (X-Request-Id, honoring one supplied by an upstream proxy/caller) before
  // anything else runs, so the exception filter below - and any future
  // logging - can tie a server-side log line back to what a client saw.
  app.use(requestIdMiddleware);
  app.useGlobalFilters(new AllExceptionsFilter());

  // Correctly resolve the real client IP from X-Forwarded-For when running
  // behind exactly one reverse proxy (a typical PaaS or nginx-in-front
  // deployment) - @nestjs/throttler's per-IP rate limiting otherwise sees
  // every request as coming from the proxy itself once actually hosted,
  // rate-limiting all users together instead of individually. Harmless
  // locally (no proxy in front, so there's no X-Forwarded-For to trust).
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Set global API prefix - health check excluded (KNOWN_RISKS.md MED-7) so
  // it's a stable, version-independent path for load balancers/uptime
  // checks to poll (GET /health, not /api/v1/health).
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  // Enable validation pipes for automatic DTO validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // KNOWN_RISKS.md MED-2: Swagger used to mount unconditionally, including
  // under NODE_ENV=production, with no auth gate - the full API schema
  // (every route, every DTO shape) served to anyone who found the URL.
  // Dev/non-prod only now; nothing in this codebase's scripts or tests
  // depends on it being reachable.
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('BhoomiSetu API')
      .setDescription('GIS-based land governance and interoperability platform API')
      .setVersion('1.0')
      .addTag('parcels')
      .addTag('auth')
      .addTag('workflows')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  // Wide open (any origin) when CORS_ORIGIN is unset, matching today's
  // local-dev behavior exactly (no regression for npm run start:dev, the
  // e2e suite, or Docker Compose's own internal traffic). Once actually
  // hosted publicly, set CORS_ORIGIN to the real deployed frontend's URL
  // (comma-separated if there's more than one) to stop any other website
  // from calling this API using a signed-in visitor's own browser session.
  //
  // KNOWN_RISKS.md MED-1: a loud warning rather than a hard refusal-to-start
  // here (unlike the JWT_SECRET/DB-credentials checks above) - docker-
  // compose.yml sets NODE_ENV=production but doesn't set CORS_ORIGIN by
  // default, so failing hard on this specific check would break that
  // already-working local/demo path for a header that, unlike a forgeable
  // JWT or DB credentials, only matters once a browser is actually involved.
  const corsOrigin = process.env.CORS_ORIGIN;
  if (process.env.NODE_ENV === 'production' && !corsOrigin) {
    console.warn(
      'WARNING: CORS_ORIGIN is unset while NODE_ENV=production - accepting cross-origin requests from any website. ' +
        'Set CORS_ORIGIN to your real deployed frontend URL before exposing this to real users.',
    );
  }
  app.enableCors({ origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : true });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap();