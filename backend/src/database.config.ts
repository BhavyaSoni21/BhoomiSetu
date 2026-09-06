import { DataSourceOptions } from 'typeorm';

// Shared by AppModule (TypeOrmModule.forRootAsync) and seed.ts (a standalone
// DataSource) so the two never drift - e.g. adding Supabase's required SSL
// flag to one but not the other would silently break exactly one of "run
// the app" vs "seed the database" (docs/FEATURE_AUDIT.md §8 item 14).
// `entities` is intentionally left empty here - each caller has its own way
// of supplying it (a glob for the compiled app, an explicit class list for
// the standalone seed script) and overrides this via object spread.
export function getDatabaseConnectionOptions(): DataSourceOptions {
  if (isSqliteConfigured()) {
    return {
      type: 'sqlite',
      database: process.env.SQLITE_PATH || './data/dev.sqlite',
      entities: [],
      synchronize: true,
    };
  }

  // Supabase (and most managed Postgres) requires SSL and has no client-
  // verifiable CA bundle configured here, hence rejectUnauthorized: false -
  // fine for this project's dev/demo use, not a substitute for real
  // certificate pinning in a production deployment. A local docker-compose
  // Postgres has no SSL listener at all, so this stays opt-in via DB_SSL
  // rather than always-on.
  const useSsl = process.env.DB_SSL === 'true';
  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'postgres',
    entities: [],
    synchronize: true,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    extra: { searchPath: ['public'] },
  };
}

export function isSqliteConfigured(): boolean {
  return process.env.USE_SQLITE === 'true' || !process.env.DB_HOST;
}
