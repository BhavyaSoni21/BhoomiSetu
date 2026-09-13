import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// Simulated output of a satellite change-detection pass: a "changed region"
// polygon plus the parcels it was generated to intersect. Populated by
// seed.ts to stand in for the real pipeline (imagery diff -> changed region
// -> spatial intersection -> affected parcels -> governance alert) built in
// a later phase.
@Entity('change_detection_events')
@Index(['state_code', 'district'])
export class ChangeDetectionEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'description', type: 'text' })
  description: string;

  @Column({ name: 'state_code', type: 'varchar', length: 10 })
  stateCode: string;

  @Column({ name: 'district', type: 'varchar', length: 40 })
  district: string;

  @Column({ name: 'geometry', type: 'text' })
  geometry: string; // GeoJSON Polygon of the changed region, as text

  @Column({ name: 'affected_parcel_ids', type: 'simple-array', nullable: true })
  affectedParcelIds: string[];

  @CreateDateColumn({ name: 'detected_at' })
  detectedAt: Date;
}
