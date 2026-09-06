import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

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

  const app = await NestFactory.create(AppModule);

  // Correctly resolve the real client IP from X-Forwarded-For when running
  // behind exactly one reverse proxy (a typical PaaS or nginx-in-front
  // deployment) - @nestjs/throttler's per-IP rate limiting otherwise sees
  // every request as coming from the proxy itself once actually hosted,
  // rate-limiting all users together instead of individually. Harmless
  // locally (no proxy in front, so there's no X-Forwarded-For to trust).
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Set global API prefix
  app.setGlobalPrefix('api/v1');

  // Enable validation pipes for automatic DTO validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // Setup Swagger for API documentation
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

  // Wide open (any origin) when CORS_ORIGIN is unset, matching today's
  // local-dev behavior exactly (no regression for npm run start:dev, the
  // e2e suite, or Docker Compose's own internal traffic). Once actually
  // hosted publicly, set CORS_ORIGIN to the real deployed frontend's URL
  // (comma-separated if there's more than one) to stop any other website
  // from calling this API using a signed-in visitor's own browser session.
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({ origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : true });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap();