import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { SmsService } from '../notifications/sms.service';
import { EmailService } from '../notifications/email.service';
import { ContactMethod } from './contact-method';
import { RegisterDto } from './dto/register.dto';
import { ContactDto } from './dto/contact.dto';
import { ProfileDetailsDto } from './dto/profile-details.dto';

export interface PublicUser {
  id: string;
  email: string | null;
  mobileNumber: string | null;
  emailVerified: boolean;
  mobileVerified: boolean;
  // Surfaced so the frontend can show "verification pending for X" even
  // after a page reload, not just within the same change-contact session -
  // a change in progress (docs/FRONTEND_UPGRADE_SPEC.md §3) is otherwise
  // invisible between AuthService.addOrChangeContact() staging it and
  // AuthService.verifyOtp() committing it.
  pendingEmail: string | null;
  pendingMobileNumber: string | null;
  name: string;
  role: string;
  // "More info, editable" Profile fields (docs/FRONTEND_UPGRADE_SPEC.md
  // follow-up) - set via updateProfileDetails below, no OTP step.
  address: string | null;
  governmentIdNumber: string | null;
  occupation: string | null;
  // Powers the Citizen Portal's restructured Profile page "member since"
  // display (docs/FRONTEND_UPGRADE_SPEC.md §4) - already on the User entity,
  // just not previously exposed to a client.
  createdAt: Date;
}

export interface LoginResult {
  accessToken: string;
  user: PublicUser;
}

const EMAIL_OTP_EXPIRY_MINUTES = 10;
const EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 30;
const EMAIL_OTP_MAX_ATTEMPTS = 5;

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
  ) {}

  async validateUser(identifier: { email?: string; mobileNumber?: string }, password: string): Promise<User | null> {
    const user = identifier.email
      ? await this.usersService.findByEmail(identifier.email)
      : await this.usersService.findByMobileNumber(identifier.mobileNumber!);
    if (!user) return null;
    const matches = await bcrypt.compare(password, user.passwordHash);
    return matches ? user : null;
  }

  login(user: User): LoginResult {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: this.toPublicUser(user),
    };
  }

  // Citizen self-registration (docs/FRONTEND_UPGRADE_SPEC.md §3) - creates
  // the account and returns a session immediately (matching how every demo
  // account already works), rather than gating login behind verification.
  // OTP is "a one-time verification step only" per the spec, a trust signal
  // on the contact method itself, not a login gate - so the citizen lands
  // signed in and can complete (or defer, exactly like Profile's add/change
  // flow) verification right after.
  async register(dto: RegisterDto): Promise<LoginResult> {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }
    if (dto.method === 'EMAIL' && (await this.usersService.findByEmail(dto.email!))) {
      throw new ConflictException('An account with this email already exists');
    }
    if (dto.method === 'MOBILE' && (await this.usersService.findByMobileNumber(dto.mobileNumber!))) {
      throw new ConflictException('An account with this mobile number already exists');
    }

    const user = await this.usersService.create({
      name: dto.name,
      email: dto.method === 'EMAIL' ? dto.email! : null,
      mobileNumber: dto.method === 'MOBILE' ? dto.mobileNumber! : null,
      passwordHash: bcrypt.hashSync(dto.password, 10),
      role: 'CITIZEN',
    });

    // A failed OTP send (e.g. the SMS/email gateway isn't configured yet)
    // shouldn't fail registration itself - the account still exists and can
    // log in; the citizen just sees an error on this specific step and can
    // retry via resend-otp once the delivery mechanism is actually working.
    try {
      await this.sendOtpFor(user, dto.method, dto.method === 'EMAIL' ? dto.email! : dto.mobileNumber!);
    } catch {
      // Swallowed deliberately - see comment above.
    }

    return this.login(user);
  }

  // Shared by registration, resend, and Profile add/change - `target` is
  // whichever value actually needs a code sent to it right now (a fresh
  // value at registration/add time, or a pending one mid-change).
  async sendOtpFor(user: User, method: ContactMethod, target: string): Promise<void> {
    if (method === 'MOBILE') {
      // Enforce resend cooldown for SMS (SmsService itself is stateless).
      const now = new Date();
      if (
        user.smsOtpSentAt &&
        now.getTime() - user.smsOtpSentAt.getTime() < this.smsService.resendCooldownSeconds * 1000
      ) {
        throw new BadRequestException(`Please wait before requesting another code`);
      }

      // TextBee is send-only: SmsService returns the hashed code + expiry
      // so we persist it on the User row (same pattern as email OTP).
      const result = await this.smsService.sendOtp(target);
      user.smsOtpCodeHash = result.codeHash;
      user.smsOtpExpiresAt = result.expiresAt;
      user.smsOtpSentAt = result.sentAt;
      user.smsOtpAttempts = 0;
      await this.usersService.save(user);
      return;
    }

    const now = new Date();
    if (user.emailOtpSentAt && now.getTime() - user.emailOtpSentAt.getTime() < EMAIL_OTP_RESEND_COOLDOWN_SECONDS * 1000) {
      throw new BadRequestException(`Please wait before requesting another code`);
    }

    const code = generateOtpCode();
    user.emailOtpCodeHash = bcrypt.hashSync(code, 10);
    user.emailOtpExpiresAt = new Date(now.getTime() + EMAIL_OTP_EXPIRY_MINUTES * 60 * 1000);
    user.emailOtpSentAt = now;
    user.emailOtpAttempts = 0;
    await this.usersService.save(user);

    await this.emailService.sendOtpEmail(target, code);
  }

  async resendOtp(user: User, method: ContactMethod): Promise<void> {
    const target = this.targetValueFor(user, method);
    if (!target) {
      throw new BadRequestException(`No ${method === 'EMAIL' ? 'email address' : 'mobile number'} on file to verify`);
    }
    await this.sendOtpFor(user, method, target);
  }

  // Verifies whichever value is currently in flight for this method - the
  // pending one if a change is in progress, otherwise the live one (covers
  // both registration/first-add and later change-contact uniformly).
  async verifyOtp(user: User, method: ContactMethod, code: string): Promise<User> {
    const target = this.targetValueFor(user, method);
    if (!target) {
      throw new BadRequestException(`No ${method === 'EMAIL' ? 'email address' : 'mobile number'} to verify`);
    }

    if (method === 'MOBILE') {
      // Local bcrypt check against the hash stored by sendOtpFor() -
      // same as email OTP; TextBee has no server-side verify API.
      const result = this.smsService.verifyOtp(
        user.smsOtpCodeHash,
        user.smsOtpExpiresAt,
        user.smsOtpAttempts,
        code,
      );

      if (!result.valid) {
        if (result.reason === 'TOO_MANY_ATTEMPTS') {
          throw new ForbiddenException('Too many incorrect attempts - request a new code');
        }
        if (result.reason === 'WRONG_CODE') {
          user.smsOtpAttempts += 1;
          await this.usersService.save(user);
        }
        throw new BadRequestException('Invalid or expired code');
      }

      // Clear SMS OTP state and promote any pending mobile number.
      user.smsOtpCodeHash = null;
      user.smsOtpExpiresAt = null;
      user.smsOtpAttempts = 0;
      if (user.pendingMobileNumber) {
        user.mobileNumber = user.pendingMobileNumber;
        user.pendingMobileNumber = null;
      }
      user.mobileVerified = true;
      return this.usersService.save(user);
    }

    if (user.emailOtpAttempts >= EMAIL_OTP_MAX_ATTEMPTS) {
      throw new ForbiddenException('Too many incorrect attempts - request a new code');
    }
    if (!user.emailOtpCodeHash || !user.emailOtpExpiresAt || user.emailOtpExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired code');
    }
    const matches = bcrypt.compareSync(code, user.emailOtpCodeHash);
    if (!matches) {
      user.emailOtpAttempts += 1;
      await this.usersService.save(user);
      throw new BadRequestException('Invalid or expired code');
    }

    if (user.pendingEmail) {
      user.email = user.pendingEmail;
      user.pendingEmail = null;
    }
    user.emailVerified = true;
    user.emailOtpCodeHash = null;
    user.emailOtpExpiresAt = null;
    user.emailOtpAttempts = 0;
    return this.usersService.save(user);
  }

  // Profile "add or change contact method" (docs/FRONTEND_UPGRADE_SPEC.md
  // §3): writes directly into email/mobileNumber when that slot is empty
  // (a first-time add - nothing to protect), or stages into
  // pendingEmail/pendingMobileNumber when it's already set and verified (a
  // change - the live value stays authoritative, and login-usable, until
  // the new one is confirmed).
  async addOrChangeContact(user: User, dto: ContactDto): Promise<User> {
    if (dto.method === 'EMAIL') {
      const value = dto.email!;
      if (await this.emailTakenByAnotherUser(value, user.id)) {
        throw new ConflictException('This email is already linked to another account');
      }
      if (user.email && user.emailVerified) {
        user.pendingEmail = value;
      } else {
        user.email = value;
        user.emailVerified = false;
      }
    } else {
      const value = dto.mobileNumber!;
      if (await this.mobileTakenByAnotherUser(value, user.id)) {
        throw new ConflictException('This mobile number is already linked to another account');
      }
      if (user.mobileNumber && user.mobileVerified) {
        user.pendingMobileNumber = value;
      } else {
        user.mobileNumber = value;
        user.mobileVerified = false;
      }
    }
    const saved = await this.usersService.save(user);
    // Same reasoning as register(): the contact value is already recorded
    // (staged as pending, or set directly) regardless of whether the OTP
    // send itself succeeds - a delivery-mechanism outage shouldn't make this
    // whole request fail and leave the citizen unsure whether their change
    // was saved. They land on the OTP step either way and can Resend once
    // delivery is actually working.
    try {
      await this.sendOtpFor(saved, dto.method, dto.method === 'EMAIL' ? dto.email! : dto.mobileNumber!);
    } catch {
      // Swallowed deliberately - see comment above.
    }
    return saved;
  }

  // Profile "more info, editable" (docs/FRONTEND_UPGRADE_SPEC.md follow-up) -
  // partial update, no OTP step: address/governmentIdNumber/occupation
  // aren't identity-verification critical the way email/mobile are, and name
  // was already just a plain column with no verification concept at all.
  async updateProfileDetails(user: User, dto: ProfileDetailsDto): Promise<User> {
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.address !== undefined) user.address = dto.address;
    if (dto.governmentIdNumber !== undefined) user.governmentIdNumber = dto.governmentIdNumber;
    if (dto.occupation !== undefined) user.occupation = dto.occupation;
    return this.usersService.save(user);
  }

  private targetValueFor(user: User, method: ContactMethod): string | null {
    return method === 'EMAIL' ? user.pendingEmail ?? user.email : user.pendingMobileNumber ?? user.mobileNumber;
  }

  private async emailTakenByAnotherUser(email: string, ownUserId: string): Promise<boolean> {
    const existing = await this.usersService.findByEmail(email);
    return existing !== null && existing.id !== ownUserId;
  }

  private async mobileTakenByAnotherUser(mobileNumber: string, ownUserId: string): Promise<boolean> {
    const existing = await this.usersService.findByMobileNumber(mobileNumber);
    return existing !== null && existing.id !== ownUserId;
  }

  // Never return passwordHash or OTP state to a client - every response
  // that carries a User goes through this rather than the raw entity.
  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      mobileNumber: user.mobileNumber,
      emailVerified: user.emailVerified,
      mobileVerified: user.mobileVerified,
      pendingEmail: user.pendingEmail,
      pendingMobileNumber: user.pendingMobileNumber,
      name: user.name,
      role: user.role,
      address: user.address,
      governmentIdNumber: user.governmentIdNumber,
      occupation: user.occupation,
      createdAt: user.createdAt,
    };
  }
}
