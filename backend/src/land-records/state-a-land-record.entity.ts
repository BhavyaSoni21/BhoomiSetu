import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// Mock "State A" land record schema (Tech.md #12): a rural/revenue-village
// style record. Deliberately structured differently from StateBLandRecord
// to demonstrate the interoperability challenge - two departments describing
// the same kind of thing with incompatible field names and units. Nothing
// here references a parcel by foreign key on purpose: resolving these to a
// canonical parcel by identifier (survey_number etc.) is Phase 5's job.
@Entity('state_a_land_records')
@Index(['surveyNumber', 'villageCode'])
export class StateALandRecord {
  @PrimaryGeneratedColumn('uuid')
  recordId: string;

  @Column({ type: 'varchar', length: 50 })
  surveyNumber: string;

  @Column({ type: 'varchar', length: 20 })
  subdivisionNumber: string;

  @Column({ type: 'varchar', length: 100 })
  ownerName: string;

  @Column({ type: 'varchar', length: 30 })
  villageCode: string;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  areaHectares: number;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  recordStatus: string;
}
