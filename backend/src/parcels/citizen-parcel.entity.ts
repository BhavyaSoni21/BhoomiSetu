import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Parcel } from './parcel.entity';
import { User } from '../users/user.entity';

// Links a citizen's login (User.role === 'CITIZEN') to the parcels
// associated with their account for the "My Parcels" dashboard
// (docs/Plan.md Phase 12). Deliberately a separate join entity - same
// pattern as ParcelIdentifier/ParcelNeighbour - rather than an ownerId
// column on Parcel, so this stays independent of the unrelated
// StateALandRecord/StateBLandRecord "ownerName"/"holderName" text fields
// (an official land record's recorded owner name is not the same concept as
// which BhoomiSetu login a parcel happens to be linked to). One-parcel-one-
// citizen is a real DB-level invariant (the unique index below), not just a
// seed-time convention - it's what makes a Land Claim conflict (workflows/
// workflows.service.ts) detectable at all.
@Entity('citizen_parcels')
@Index(['citizen'])
@Index(['parcel'], { unique: true })
export class CitizenParcel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'citizen_id' })
  citizen: User;

  @ManyToOne(() => Parcel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parcel_id' })
  parcel: Parcel;
}
