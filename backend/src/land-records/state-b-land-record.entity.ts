import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// Mock "State B" land record schema (Tech.md #13): an urban plot-style
// record - different field names, different units (sqft vs hectares) than
// StateALandRecord, on purpose. See state-a-land-record.entity.ts for why
// there's no parcel foreign key here.
@Entity('state_b_land_records')
@Index(['plotId', 'localityId'])
export class StateBLandRecord {
  @PrimaryGeneratedColumn('uuid')
  recordId: string;

  @Column({ type: 'varchar', length: 50 })
  plotId: string;

  @Column({ type: 'varchar', length: 100 })
  holderName: string;

  @Column({ type: 'varchar', length: 30 })
  localityId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  landExtentSqft: number;

  @Column({ type: 'varchar', length: 30 })
  recordCategory: string;
}
