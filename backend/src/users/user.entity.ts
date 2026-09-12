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

  // Email OTP challenge state. TextBee (SMS gateway) is send-only so SMS OTP
  // needs the same columns - both methods store the hashed code + expiry here
  // and verify locally (bcrypt compare) rather than delegating to a provider.
  @Column({ type: 'varchar', nullable: true })
  emailOtpCodeHash: string | null;

  @Column({ type: isSqliteConfigured() ? 'datetime' : 'timestamp', nullable: true })
  emailOtpExpiresAt: Date | null;

  // Resend rate-limiting and lockout for email OTP (reset on every new send).
  @Column({ type: isSqliteConfigured() ? 'datetime' : 'timestamp', nullable: true })
  emailOtpSentAt: Date | null;

  @Column({ type: 'int', default: 0 })
  emailOtpAttempts: number;

  // SMS OTP challenge state - mirrors the email OTP columns above.
  // TextBee sends the SMS but doesn't store/verify the code; we do.
  @Column({ type: 'varchar', nullable: true })
  smsOtpCodeHash: string | null;

  @Column({ type: isSqliteConfigured() ? 'datetime' : 'timestamp', nullable: true })
  smsOtpExpiresAt: Date | null;

  @Column({ type: isSqliteConfigured() ? 'datetime' : 'timestamp', nullable: true })
  smsOtpSentAt: Date | null;

  @Column({ type: 'int', default: 0 })
  smsOtpAttempts: number;

  @Column({ type: 'varchar' })
  passwordHash: string;

  // Bumped on explicit logout (KNOWN_RISKS.md HIGH-2) so a JWT issued before
  // that point - this device's, or any other copy of it - stops validating
  // immediately instead of staying valid forever, since tokens themselves
  // carry no expiry (see auth.module.ts). JwtStrategy.validate() rejects any
  // token whose embedded tokenVersion doesn't match this current value.
  @Column({ type: 'int', default: 0 })
  tokenVersion: number;

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
