import { Entity, PrimaryGeneratedColumn, Column, Index, OneToMany } from 'typeorm';
import { ParcelIdentifier } from './parcel-identifier.entity';

@Entity('parcels')
@Index(['stateCode', 'districtCode'])
@Index(['canonicalParcelId'])
@Index(['ulpin'])
@Index(['clusterId'])
export class Parcel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  canonicalParcelId: string | null;

  // Identifies the connected cadastral network (e.g. "MH-PUNE-01") a parcel's
  // geometry was generated as part of - null for parcels not seeded as part
  // of a cluster. See ParcelNeighbour for explicit touching/nearby edges.
  @Column({ type: 'varchar', length: 50, nullable: true })
  clusterId: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ulpin: string | null;

  @Column({ type: 'varchar', length: 10 })
  stateCode: string;

  @Column({ type: 'varchar', length: 20 })
  districtCode: string;

  @Column({ type: 'varchar', length: 20 })
  localBodyCode: string;

  // Geometry stored as JSON string (GeoJSON format)
  // In production with PostGIS, this would be a proper geometry type
  @Column({ type: 'text' })
  geometry: string; // GeoJSON as text

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  areaSqM: number;

  @OneToMany(() => ParcelIdentifier, (identifier) => identifier.parcel)
  identifiers: ParcelIdentifier[];

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}