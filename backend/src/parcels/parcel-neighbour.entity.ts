import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// Explicit, precomputed spatial relationship between two parcels. For the
// SQLite MVP these are generated at seed time from known grid row/column
// position (reliable) rather than derived live from geometry (see
// geo-utils.ts, still used as a fallback for parcels with no rows here -
// e.g. ad-hoc/non-seeded data). Stored bidirectionally: selecting either
// parcel finds the relationship with a single `parcelId = :id` lookup.
@Entity('parcel_neighbours')
@Index(['parcel_id'])
export class ParcelNeighbour {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'parcel_id', type: 'varchar' })
  parcelId: string;

  @Column({ name: 'neighbour_parcel_id', type: 'varchar' })
  neighbourParcelId: string;

  @Column({ name: 'relationship_type', type: 'varchar', length: 20 })
  relationshipType: string; // TOUCHING | NEARBY
}
