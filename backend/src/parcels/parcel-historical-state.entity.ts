import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// Attribute-level history, per year, deliberately NOT geometry (the parcel's
// boundary shape is never re-versioned here - only the values other tabs
// already show today, snapshotted per year). Multiple rows per parcel, one
// per year; the most recent year corresponds to the live values State A/B,
// planning, restriction, and tax records already expose.
//
// Built as the prerequisite for the historical parcel-imagery comparison
// feature (docs/FRONTEND_UPGRADE_SPEC.md §8): a cluster snapshot showing a
// parcel visually changed in year Y is only "unauthorized" if THIS table has
// no matching recorded attribute change for that parcel/year - the check
// that decides whether HistoricalComparisonService creates a
// GovernanceAlert or treats the change as already-on-record.
@Entity('parcel_historical_states')
@Index(['parcelId', 'year'])
export class ParcelHistoricalState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  parcelId: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'varchar', length: 40, nullable: true })
  landUse: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  zoningStatus: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  restrictionStatus: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  taxStatus: string | null;
}
