import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// Restriction polygon (e.g. flood-prone area) that crosses parcel boundaries,
// used to demonstrate spatial-intersection queries ("which parcels does this
// restriction affect?"). Populated by seed.ts; a Restriction department API
// will read from this in a later phase.
@Entity('restriction_zones')
@Index(['stateCode', 'district'])
export class RestrictionZone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 30 })
  restrictionType: string; // FLOOD | ENVIRONMENTAL | PROTECTED_AREA

  @Column({ type: 'varchar', length: 10 })
  stateCode: string;

  @Column({ type: 'varchar', length: 40 })
  district: string;

  @Column({ type: 'text' })
  geometry: string; // GeoJSON Polygon, as text

  @Column({ type: 'simple-array', nullable: true })
  affectedParcelIds: string[]; // parcels this restriction intersects

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
