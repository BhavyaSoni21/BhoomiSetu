import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

// Admin Portal "Department management" (docs/FRONTEND_UPGRADE_SPEC.md §7,
// Phase 3) - display/admin metadata only. The six mock department domain
// modules (backend/src/departments/*.entity.ts) and ROLE_DEPARTMENT
// (auth/roles.constants.ts) keep working exactly as they do today; this
// table doesn't replace or feed into either - the pragmatic prototype
// choice the spec itself calls out. `code` is expected to line up with
// those hardcoded department strings (LAND_RECORDS, REGISTRATION, ...) so
// an admin editing "Land Records" here is recognizably the same department
// elsewhere in the app, but nothing enforces that at the database level.
@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 40, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  contactEmail: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  contactPhone: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
