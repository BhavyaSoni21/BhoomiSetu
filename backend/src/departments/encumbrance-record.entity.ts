import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// Mock Encumbrance/Mortgage Department record - a required "essential
// layer" named by the fuller "Land Stack" PS text with no source document
// naming it before that (docs/FEATURE_AUDIT.md §1a/§8 item 17). Mirrors the
// existing DisputeRecord's shape: a per-parcel business record keyed by a
// plain parcelId string, independent of the other mock departments.
@Entity('encumbrance_records')
@Index(['parcelId'])
export class EncumbranceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  parcelId: string;

  @Column({ type: 'boolean', default: false })
  hasEncumbrance: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  encumbranceType: string | null; // MORTGAGE | LIEN | CHARGE

  @Column({ type: 'varchar', length: 100, nullable: true })
  lenderName: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  instrumentReference: string | null;

  @Column({ type: 'date', nullable: true })
  registeredDate: string | null;

  @Column({ type: 'date', nullable: true })
  dischargeDate: string | null;
}
