import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// Mock infrastructure (roads, utility lines) near a parcel cluster, used to
// demonstrate proximity queries ("which parcels are near this road?").
// Populated by seed.ts.
@Entity('infrastructure_features')
@Index(['state_code', 'district'])
export class InfrastructureFeature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'feature_type', type: 'varchar', length: 30 })
  featureType: string; // ROAD | WATER_LINE | ELECTRICITY

  @Column({ name: 'state_code', type: 'varchar', length: 10 })
  stateCode: string;

  @Column({ name: 'district', type: 'varchar', length: 40 })
  district: string;

  @Column({ name: 'geometry', type: 'text' })
  geometry: string; // GeoJSON LineString or Point, as text

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
