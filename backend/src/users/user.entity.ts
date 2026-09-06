import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// Phase 10: real accounts backing what was previously a client-side-only
// "pick a name and role" simulated session (see docs/FEATURE_AUDIT.md §8
// item 9). Scoped to Officer + Admin roles - the Citizen Portal has never
// had an account concept (search and service requests are anonymous today),
// so there is no "citizen session" to migrate.
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'varchar' })
  passwordHash: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', length: 30 })
  role: string; // ADMIN | LAND_RECORD_OFFICER | REGISTRATION_OFFICER | PLANNING_OFFICER | DISPUTE_OFFICER

  @CreateDateColumn()
  createdAt: Date;
}
