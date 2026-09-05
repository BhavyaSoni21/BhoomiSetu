import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        // Use SQLite for development if PostgreSQL is not available
        const useSqlite = process.env.USE_SQLITE === 'true' || !process.env.DB_HOST;

        if (useSqlite) {
          return {
            type: 'sqlite',
            database: process.env.SQLITE_PATH || './data/dev.sqlite',
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: true,
            // SQLite doesn't support PostGIS, so we'll store geometry as text
            // and handle spatial operations in the service layer for development
          };
        } else {
          return {
            type: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT ?? '5432', 10),
            username: process.env.DB_USERNAME || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            database: process.env.DB_NAME || 'bhoomisetu',
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: true, // Set to false in production
            // Enable PostGIS extension
            extra: {
              searchPath: ['public'],
            },
          };
        }
      },
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
    AuditModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}