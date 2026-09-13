import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Parcel } from './parcel.entity';

@Entity('parcel_identifiers')
@Index(['identifier_type', 'identifier_value'])
@Index(['source_state', 'identifier_type', 'identifier_value'])
export class ParcelIdentifier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Parcel, (parcel) => parcel.identifiers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parcel_id' })
  parcel: Parcel;

  @Column({ name: 'identifier_type', type: 'varchar', length: 50 })
  identifierType: string; // e.g., 'ULPIN', 'SURVEY_NUMBER', 'PLOT_NUMBER', 'LOCAL_PARCEL_ID'

  @Column({ name: 'identifier_value', type: 'varchar', length: 100 })
  identifierValue: string;

  @Column({ name: 'source_state', type: 'varchar', length: 10 })
  sourceState: string; // State that issued this identifier

  @Column({ name: 'source_department', type: 'varchar', length: 50 })
  sourceDepartment: string; // Department that issued this identifier
}