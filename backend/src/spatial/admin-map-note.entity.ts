import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// Admin-only map annotation (docs/ADMIN_PANEL_ISSUES.md Coming Soon #3
// follow-up, per the user's explicit "a map layer that should be visible to
// admin only and editable by admin only") - unlike ZoningOverlay/
// RestrictionZone/InfrastructureFeature, which are public reference data
// (read by anyone via SpatialController, rendered on the shared citizen/
// officer map, features/map/MapComponent.tsx), every endpoint for this
// entity is ADMIN-only, including reads (see SpatialController's
// admin-notes routes) - it is never fetched by MapComponent.tsx, so it
// simply doesn't exist for a citizen or officer session. General-purpose
// (Point/LineString/Polygon), not domain-typed like the other three, since
// its purpose is free-form internal tracking, not a fixed category.
@Entity('admin_map_notes')
@Index(['stateCode', 'district'])
export class AdminMapNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 10 })
  stateCode: string;

  @Column({ type: 'varchar', length: 40 })
  district: string;

  @Column({ type: 'text' })
  geometry: string; // GeoJSON Point | LineString | Polygon, as text

  // Plain string, no FK - same convention as AuditLog.userId/Notification.userId.
  @Column({ type: 'varchar', nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
