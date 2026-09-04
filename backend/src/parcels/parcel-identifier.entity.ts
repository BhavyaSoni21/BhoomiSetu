import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Parcel } from './parcel.entity';

@Entity('parcel_identifiers')
@Index(['identifierType', 'identifierValue'])
@Index(['sourceState', 'identifierType', 'identifierValue'])
export class ParcelIdentifier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Parcel, (parcel) => parcel.identifiers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parcel_id' })
  parcel: Parcel;

  @Column({ type: 'varchar', length: 50 })
  identifierType: string; // e.g., 'ULPIN', 'SURVEY_NUMBER', 'PLOT_NUMBER', 'LOCAL_PARCEL_ID'

  @Column({ type: 'varchar', length: 100 })
  identifierValue: string;

  @Column({ type: 'varchar', length: 10 })
  sourceState: string; // State that issued this identifier

  @Column({ type: 'varchar', length: 50 })
  sourceDepartment: string; // Department that issued this identifier
}