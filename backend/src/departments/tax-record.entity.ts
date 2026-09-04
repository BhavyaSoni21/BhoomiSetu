import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// Mock Tax Department record (Tech.md #16.4): property tax, tax status,
// outstanding amount.
@Entity('tax_records')
@Index(['parcelId'])
export class TaxRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  parcelId: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  assessedValue: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  annualTaxAmount: number;

  @Column({ type: 'varchar', length: 20 })
  taxStatus: string; // PAID | PENDING | OVERDUE

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  outstandingAmount: number;

  @Column({ type: 'date', nullable: true })
  lastPaymentDate: string | null;
}
