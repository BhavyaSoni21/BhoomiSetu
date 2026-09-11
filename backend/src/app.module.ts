import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { GisModule } from './gis/gis.module';
import { ParcelsModule } from './parcels/parcels.module';
import { SpatialModule } from './spatial/spatial.module';
import { LandRecordsModule } from './land-records/land-records.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DepartmentsModule } from './departments/departments.module';
import { InteroperabilityModule } from './interoperability/interoperability.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { GovernanceModule } from './governance/governance.module';
import { AiModule } from './ai/ai.module';
import { ChangeDetectionModule } from './change-detection/change-detection.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PredictiveAnalyticsModule } from './predictive-analytics/predictive-analytics.module';
import { AuditModule } from './audit/audit.module';
import { HistoricalImageryModule } from './historical-imagery/historical-imagery.module';
import { AdminModule } from './admin/admin.module';
import { NotificationFeedModule } from './notification-feed/notification-feed.module';
import { HealthController } from './health/health.controller';
import { getDatabaseConnectionOptions } from './database.config';

@Module({
  imports: [
    // Tech.md's Security Requirements list rate limiting explicitly (§39);
    // a generous global default (200 requests/minute/IP - well above what
    // any real citizen/officer session or this project's own e2e test
    // suites generate) with a tighter limit on the Groq-backed AI endpoints
    // specifically, since those cost real money per call - see AiController.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),
    TypeOrmModule.forRootAsync({
      // SQLite (dev/test, no external DB needed) vs Postgres+PostGIS - see
      // database.config.ts, shared with seed.ts so both ever branch the same way.
      useFactory: () => ({
        ...getDatabaseConnectionOptions(),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
      }),
    }),
    GisModule,
    ParcelsModule,
    SpatialModule,
    LandRecordsModule,
    AuthModule,
    UsersModule,
    DepartmentsModule,
    InteroperabilityModule,
    WorkflowsModule,
    GovernanceModule,
    AiModule,
    ChangeDetectionModule,
    AnalyticsModule,
    PredictiveAnalyticsModule,
    AuditModule,
    HistoricalImageryModule,
    AdminModule,
    NotificationFeedModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}