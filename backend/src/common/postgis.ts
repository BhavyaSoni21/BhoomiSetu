import { ObjectLiteral, Repository } from 'typeorm';

// Whichever repository is handy already carries a live connection - checking
// its actual connected driver type (rather than re-reading env vars) is the
// single source of truth for "did we really connect to Postgres", matching
// whatever TypeORM itself decided at bootstrap (docs/FEATURE_AUDIT.md §8
// item 14). Real PostGIS ST_* queries only run on this path; SQLite falls
// back to the hand-rolled JS geo-utils.ts helpers, since SQLite has no
// PostGIS extension to run them against.
export function isPostgisAvailable(repository: Repository<ObjectLiteral>): boolean {
  return repository.manager.connection.options.type === 'postgres';
}
