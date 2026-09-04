import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// Simulated output of a satellite change-detection pass: a "changed region"
// polygon plus the parcels it was generated to intersect. Populated by
// seed.ts to stand in for the real pipeline (imagery diff -> changed region
// -> spatial intersection -> affected parcels -> governance alert) built in
// a later phase.
@Entity('change_detection_events')
@Index(['stateCode', 'district'])
export class ChangeDetectionEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 10 })
  stateCode: string;

  @Column({ type: 'varchar', length: 40 })
  district: string;

  @Column({ type: 'text' })
  geometry: string; // GeoJSON Polygon of the changed region, as text

  @Column({ type: 'simple-array', nullable: true })
  affectedParcelIds: string[];

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  detectedAt: Date;
}
