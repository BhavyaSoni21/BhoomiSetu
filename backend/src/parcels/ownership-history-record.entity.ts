import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// A parcel's chain of past owners (docs/FEATURE_AUDIT.md §1a/§8a) - sits
// behind the current-owner fields State A/B land records already expose
// (ownerName/holderName), not a replacement for them. Multiple rows per
// parcel, ordered by transactionDate; the most recent entry corresponds to
// the owner already recorded there. Visibility is citizen-restricted (only
// a citizen associated with the parcel via CitizenParcel can see it) -
// enforced in ParcelsController, not here.
@Entity('ownership_history_records')
@Index(['parcel_id'])
export class OwnershipHistoryRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'parcel_id', type: 'varchar' })
  parcelId: string;

  @Column({ name: 'owner_name', type: 'varchar', length: 100 })
  ownerName: string;

  @Column({ name: 'transaction_type', type: 'varchar', length: 20 })
  transactionType: string; // ORIGINAL | SALE | GIFT | INHERITANCE | PARTITION

  @Column({ name: 'transaction_date', type: 'date' })
  transactionDate: string;

  @Column({ name: 'document_reference', type: 'varchar', length: 60, nullable: true })
  documentReference: string | null;
}
