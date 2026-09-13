import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm';
import { ParcelIdentifier } from './parcel-identifier.entity';

@Entity('parcels')
@Index(['state_code', 'district_code'])
@Index(['canonical_parcel_id'])
@Index(['ulpin'])
@Index(['cluster_id'])
export class Parcel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'canonical_parcel_id', type: 'varchar', length: 50, nullable: true })
  canonicalParcelId: string | null;

  // Identifies the connected cadastral network (e.g. "MH-PUNE-01") a parcel's
  // geometry was generated as part of - null for parcels not seeded as part
  // of a cluster. See ParcelNeighbour for explicit touching/nearby edges.
  @Column({ name: 'cluster_id', type: 'varchar', length: 50, nullable: true })
  clusterId: string | null;

  @Column({ name: 'ulpin', type: 'varchar', length: 50, nullable: true })
  ulpin: string | null;

  @Column({ name: 'state_code', type: 'varchar', length: 10 })
  stateCode: string;

  @Column({ name: 'district_code', type: 'varchar', length: 20 })
  districtCode: string;

  @Column({ name: 'local_body_code', type: 'varchar', length: 20 })
  localBodyCode: string;

  // Geometry stored as JSON string (GeoJSON format)
  // In production with PostGIS, this would be a proper geometry type
  @Column({ name: 'geometry', type: 'text' })
  geometry: string; // GeoJSON as text

  @Column({ name: 'area_sq_m', type: 'decimal', precision: 15, scale: 2 })
  areaSqM: number;

  @OneToMany(() => ParcelIdentifier, (identifier) => identifier.parcel)
  identifiers: ParcelIdentifier[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}