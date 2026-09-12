import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { isSqliteConfigured } from '../database.config';

// A citizen registration that hasn't proven ownership of its contact method
// yet (per the user's explicit "the account should not be created until the
// number or the email is verified") - no User row exists for this person
// until verifyRegistrationOtp() succeeds, so nothing here can be used to log
// in, and abandoning it (never entering the code) leaves no account behind.
// Single OTP column set, unlike User's separate emailOtp*/smsOtp* pairs -
// `method` is fixed for the lifetime of one pending registration (the
// method-selector is chosen once, at the start of the form), so there's
// never a second channel to track state for the way an existing account's
// Profile page has to.
@Entity('pending_registrations')
export class PendingRegistration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', length: 10 })
  method: string; // EMAIL | MOBILE

  // Unique (nullable-safe, same as User's own email/mobileNumber index) so a
  // race between two concurrent register() calls for the same contact can't
  // create two live pending rows for it.
  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  mobileNumber: string | null;

  @Column({ type: 'varchar' })
  passwordHash: string;

  @Column({ type: 'varchar', nullable: true })
  otpCodeHash: string | null;

  @Column({ type: isSqliteConfigured() ? 'datetime' : 'timestamp', nullable: true })
  otpExpiresAt: Date | null;

  @Column({ type: isSqliteConfigured() ? 'datetime' : 'timestamp', nullable: true })
  otpSentAt: Date | null;

  @Column({ type: 'int', default: 0 })
  otpAttempts: number;

  @CreateDateColumn()
  createdAt: Date;
}
