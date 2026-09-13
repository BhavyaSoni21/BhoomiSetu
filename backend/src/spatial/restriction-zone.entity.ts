import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// Restriction polygon (e.g. flood-prone area) that crosses parcel boundaries,
// used to demonstrate spatial-intersection queries ("which parcels does this
// restriction affect?"). Populated by seed.ts; a Restriction department API
// will read from this in a later phase.
@Entity('restriction_zones')
@Index(['state_code', 'district'])
export class RestrictionZone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'restriction_type', type: 'varchar', length: 30 })
  restrictionType: string; // FLOOD | ENVIRONMENTAL | PROTECTED_AREA

  @Column({ name: 'state_code', type: 'varchar', length: 10 })
  stateCode: string;

  @Column({ name: 'district', type: 'varchar', length: 40 })
  district: string;

  @Column({ name: 'geometry', type: 'text' })
  geometry: string; // GeoJSON Polygon, as text

  @Column({ name: 'affected_parcel_ids', type: 'simple-array', nullable: true })
  affectedParcelIds: string[]; // parcels this restriction intersects

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
