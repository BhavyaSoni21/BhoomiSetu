import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// Land-use zoning polygon (residential / commercial / agricultural) used to
// demonstrate zoning analysis over a parcel cluster. Populated by seed.ts;
// a Planning department API will read from this in a later phase.
@Entity('zoning_overlays')
@Index(['stateCode', 'district'])
export class ZoningOverlay {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 30 })
  zoneType: string; // RESIDENTIAL | COMMERCIAL | AGRICULTURAL

  @Column({ type: 'varchar', length: 10 })
  stateCode: string;

  @Column({ type: 'varchar', length: 40 })
  district: string;

  @Column({ type: 'text' })
  geometry: string; // GeoJSON Polygon, as text

  @Column({ type: 'simple-array', nullable: true })
  parcelIds: string[]; // parcels this overlay was generated to cover

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
