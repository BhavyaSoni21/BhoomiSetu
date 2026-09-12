import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// Mock Restriction Department record (Tech.md #16.5): environmental zones,
// protected areas, other restrictions. This is a per-parcel *business*
// record ("does the Restriction department have a flag on this parcel?"),
// distinct from spatial.RestrictionZone which is the GIS overlay *polygon*
// (Pune-only, geometry-based). For Pune, hasRestriction is set consistent
// with membership in the flood RestrictionZone's affectedParcelIds.
@Entity('restriction_records')
@Index(['parcelId'])
export class RestrictionRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  parcelId: string;

  @Column({ type: 'boolean', default: false })
  hasRestriction: boolean;

  @Column({ type: 'varchar', length: 30, nullable: true })
  restrictionType: string | null; // ENVIRONMENTAL | PROTECTED_AREA | FLOOD_PRONE

  @Column({ type: 'varchar', length: 200, nullable: true })
  restrictionDetails: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  imposingAuthority: string | null;
}
