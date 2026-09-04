import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// Mock Registration Department record (Tech.md #16.2): registration status,
// transaction records, registration history. `parcelId` is a plain string
// matching Parcel.id by value, not a TypeORM relation - this is meant to
// stand in for an independent department system that merely happens to
// reference the same identifier, the same way the other four department
// mocks do.
@Entity('registration_records')
@Index(['parcelId'])
export class RegistrationRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  parcelId: string;

  @Column({ type: 'varchar', length: 20 })
  registrationStatus: string; // REGISTERED | PENDING | NOT_REGISTERED

  @Column({ type: 'varchar', length: 40, nullable: true })
  registrationNumber: string | null;

  @Column({ type: 'date', nullable: true })
  registrationDate: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  lastTransactionType: string | null; // SALE | GIFT | INHERITANCE | PARTITION

  @Column({ type: 'date', nullable: true })
  lastTransactionDate: string | null;
}
