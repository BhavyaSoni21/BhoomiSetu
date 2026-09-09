import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { isSqliteConfigured } from '../database.config';

// Phase 10: real accounts backing what was previously a client-side-only
// "pick a name and role" simulated session (see docs/FEATURE_AUDIT.md §8
// item 9). Scoped to Officer + Admin roles - the Citizen Portal has never
// had an account concept (search and service requests are anonymous today),
// so there is no "citizen session" to migrate.
//
// Mobile/email OTP verification (docs/AUTH_VERIFICATION_UPGRADE.md,
// docs/FRONTEND_UPGRADE_SPEC.md §3) is citizen-only in UX terms, but the
// columns below live on this shared table rather than a citizen-only one,
// same as `role` itself already mixing staff and citizen concerns - officer/
// admin accounts just get `emailVerified: true` at creation time (admin-
// provisioned, already trusted) and never touch `mobileNumber`/mobile OTP.
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Both nullable now ("at least one present" is a service-layer/DTO
  // constraint, not a DB one - TypeORM's unique index already allows
  // multiple NULLs on both sqlite and postgres, so two citizens who've each
  // only added a mobile number don't collide on a shared NULL email).
  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  mobileNumber: string | null;

  @Column({ type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ type: 'boolean', default: false })
  mobileVerified: boolean;

  // Staged new value for the Profile "change contact" flow
  // (docs/FRONTEND_UPGRADE_SPEC.md §3: "the old verified method is never
  // dropped before the new one is confirmed working") - verifying a pending
  // value copies it into email/mobileNumber above and clears this, rather
  // than ever overwriting a live verified value up front.
  @Column({ type: 'varchar', nullable: true })
  pendingEmail: string | null;

  @Column({ type: 'varchar', nullable: true })
  pendingMobileNumber: string | null;

  // Email OTP challenge state - mobile OTP needs none of this equivalent,
  // Fast2SMS generates, stores, and checks the code on its own servers (see
  // SmsService); this codebase's own database never holds a mobile OTP code.
  @Column({ type: 'varchar', nullable: true })
  emailOtpCodeHash: string | null;

  @Column({ type: isSqliteConfigured() ? 'datetime' : 'timestamp', nullable: true })
  emailOtpExpiresAt: Date | null;

  // Resend rate-limiting (Fast2SMS enforces its own resend window for
  // mobile; nothing does that for us on the email side, so this does).
  @Column({ type: isSqliteConfigured() ? 'datetime' : 'timestamp', nullable: true })
  emailOtpSentAt: Date | null;

  // Lockout after repeated wrong codes, reset on every new send.
  @Column({ type: 'int', default: 0 })
  emailOtpAttempts: number;

  @Column({ type: 'varchar' })
  passwordHash: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', length: 30 })
  role: string; // ADMIN | LAND_RECORD_OFFICER | REGISTRATION_OFFICER | PLANNING_OFFICER | DISPUTE_OFFICER | TAX_OFFICER | RESTRICTION_OFFICER | ENCUMBRANCE_OFFICER | CITIZEN

  // Profile "more info" fields (docs/FRONTEND_UPGRADE_SPEC.md follow-up,
  // 2026-09-09) - citizen-editable via PATCH /auth/profile/details, no OTP
  // step (unlike email/mobile above - these aren't identity-verification
  // critical). Nullable/optional for every existing account, including staff.
  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', nullable: true })
  governmentIdNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  occupation: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
