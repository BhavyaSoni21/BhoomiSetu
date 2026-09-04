import { Entity, PrimaryGeneratedColumn, Column, Index, OneToMany } from 'typeorm';
import { ParcelIdentifier } from './parcel-identifier.entity';

@Entity('parcels')
@Index(['stateCode', 'districtCode'])
@Index(['canonicalParcelId'])
@Index(['ulpin'])
export class Parcel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  canonicalParcelId: string | null;

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