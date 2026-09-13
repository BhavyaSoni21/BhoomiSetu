import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// Land-use zoning polygon (residential / commercial / agricultural) used to
// demonstrate zoning analysis over a parcel cluster. Populated by seed.ts;
// a Planning department API will read from this in a later phase.
@Entity('zoning_overlays')
@Index(['state_code', 'district'])
export class ZoningOverlay {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'zone_type', type: 'varchar', length: 30 })
  zoneType: string; // RESIDENTIAL | COMMERCIAL | AGRICULTURAL

  @Column({ name: 'state_code', type: 'varchar', length: 10 })
  stateCode: string;

  @Column({ name: 'district', type: 'varchar', length: 40 })
  district: string;

  @Column({ name: 'geometry', type: 'text' })
  geometry: string; // GeoJSON Polygon, as text

  @Column({ name: 'parcel_ids', type: 'simple-array', nullable: true })
  parcelIds: string[]; // parcels this overlay was generated to cover

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
