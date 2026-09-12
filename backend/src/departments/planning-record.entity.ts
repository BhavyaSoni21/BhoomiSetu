import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// Mock Planning Department record (Tech.md #16.3): land use, zoning, master
// plan info. For the Pune cluster, landUse is generated consistent with
// which ZoningOverlay (see spatial module) the parcel actually falls in,
// rather than being independently random.
@Entity('planning_records')
@Index(['parcelId'])
export class PlanningRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  parcelId: string;

  @Column({ type: 'varchar', length: 20 })
  landUse: string; // RESIDENTIAL | COMMERCIAL | AGRICULTURAL | MIXED_USE

  @Column({ type: 'varchar', length: 40 })
  zoningClassification: string;

  @Column({ type: 'varchar', length: 60 })
  masterPlanReference: string;

  @Column({ type: 'varchar', length: 20, default: 'NOT_REQUIRED' })
  buildingPermissionStatus: string; // APPROVED | PENDING | NOT_REQUIRED
}
