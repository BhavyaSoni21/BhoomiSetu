import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// Mock infrastructure (roads, utility lines) near a parcel cluster, used to
// demonstrate proximity queries ("which parcels are near this road?").
// Populated by seed.ts.
@Entity('infrastructure_features')
@Index(['stateCode', 'district'])
export class InfrastructureFeature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 30 })
  featureType: string; // ROAD | WATER_LINE | ELECTRICITY

  @Column({ type: 'varchar', length: 10 })
  stateCode: string;

  @Column({ type: 'varchar', length: 40 })
  district: string;

  @Column({ type: 'text' })
  geometry: string; // GeoJSON LineString or Point, as text

  @CreateDateColumn()
  createdAt: Date;
}
