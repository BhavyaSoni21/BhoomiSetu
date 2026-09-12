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
      synchronize: isSynchronizeEnabled(),
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
    synchronize: isSynchronizeEnabled(),
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    // keepAlive (TCP-level, not pg's own idle-client recycling - that's
    // already on by default) matters specifically against Supabase's
    // pgbouncer-based transaction pooler: a long-lived server process can
    // end up holding a pooled connection whose underlying socket was
    // silently dropped by the pooler/network without a clean FIN, which
    // otherwise surfaces as a real request failing with a plain 500 the
    // next time that connection is picked up - observed live (login
    // returning 500 after the backend had been running for hours, resolved
    // immediately by a restart).
    extra: { searchPath: ['public'], keepAlive: true, connectionTimeoutMillis: 10000 },
  };
}

export function isSqliteConfigured(): boolean {
  return process.env.USE_SQLITE === 'true' || !process.env.DB_HOST;
}

// KNOWN_RISKS.md HIGH-3: TypeORM's own "never in production" flag was
// unconditionally true before this - a destructive migration mistake
// (renaming a column, changing a type) became a silent, automatic,
// unreviewed schema change on the next boot against whichever database was
// configured, dev or production.
//
// Deliberately its own opt-out flag (default true) rather than tied to
// NODE_ENV=production directly: docker-compose.yml's backend service sets
// NODE_ENV=production so main.ts's JWT_SECRET check forces a real secret,
// but this project has no real TypeORM migrations yet (that's separate,
// larger follow-up work) - if this were tied to NODE_ENV instead, a fresh
// `docker-compose up` (empty Postgres volume) would boot with no tables at
// all and nothing to create them. A real deployment that does add
// migrations should set DB_SYNCHRONIZE=false explicitly once it does.
function isSynchronizeEnabled(): boolean {
  return process.env.DB_SYNCHRONIZE !== 'false';
}
