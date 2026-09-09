import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// One row per cluster per year (docs/FRONTEND_UPGRADE_SPEC.md §8) - a small,
// fixed archive (~25 rows: 5 clusters x 5 years, 2022-2026 - 2026 being the
// app's current year), not one per parcel.
// `imagePath` points at a PNG on disk (backend/uploads/cluster-snapshots/,
// gitignored) served back through HistoricalImageryController - the first
// place in this codebase that persists a generated image to disk rather
// than processing an uploaded one in memory and discarding it (see
// ChangeDetectionService for the in-memory convention this deliberately
// departs from, since these need to be fetched again on-demand later, not
// just processed once).
@Entity('cluster_historical_snapshots')
@Index(['clusterId', 'year'], { unique: true })
export class ClusterHistoricalSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  clusterId: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'varchar' })
  imagePath: string;

  // JSON-encoded {minLng, minLat, maxLng, maxLat} - stored as text rather
  // than four separate float columns, matching every other geo value in
  // this codebase (Parcel.geometry, ChangeDetectionEvent.geometry): no
  // cross-DB float-type portability to worry about (docs/FEATURE_AUDIT.md
  // §8 item 14 already caught a sqlite-vs-postgres column-type mismatch
  // once for a *date* column - not worth risking the same class of bug
  // here for a value nothing ever needs to run a numeric DB query against).
  @Column({ type: 'varchar' })
  bounds: string;

  @CreateDateColumn()
  generatedAt: Date;
}
