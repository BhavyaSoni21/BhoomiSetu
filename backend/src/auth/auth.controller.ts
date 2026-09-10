import { Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto, ResendOtpDto } from './dto/verify-otp.dto';
import { VerifyRegistrationOtpDto, ResendRegistrationOtpDto } from './dto/registration-otp.dto';
import { ContactDto } from './dto/contact.dto';
import { ProfileDetailsDto } from './dto/profile-details.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { CurrentUser } from './current-user.decorator';
import { CITIZEN_ROLE, ALL_STAFF_ROLES } from './roles.constants';
import { User } from '../users/user.entity';
import { AuditService } from '../audit/audit.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser({ email: dto.email, mobileNumber: dto.mobileNumber }, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const result = this.authService.login(user);
    await this.auditService.log({
      userId: user.id,
      userRole: user.role,
      action: 'AUTH_LOGIN',
      entityType: 'USER',
      entityId: user.id,
    });
    return result;
  }

  // Citizen self-registration only (docs/FRONTEND_UPGRADE_SPEC.md §3) -
  // Officer/Admin accounts stay admin-created via POST /users. No account
  // exists yet after this call (per the user's explicit "the account should
  // not be created until the number or the email is verified") - it only
  // stages a PendingRegistration and returns enough for the frontend to
  // drive the OTP step. See verifyRegistrationOtp below for where the real
  // account (and its first audit log entry) actually gets created.
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // Public (no account/JWT exists yet) - the only step that actually
  // creates the User row. Mirrors verifyOtp below in shape, but keyed by
  // registrationId (a PendingRegistration) rather than the signed-in user.
  @Post('register/verify-otp')
  async verifyRegistrationOtp(@Body() dto: VerifyRegistrationOtpDto) {
    const result = await this.authService.verifyRegistrationOtp(dto.registrationId, dto.code);
    await this.auditService.log({
      userId: result.user.id,
      userRole: result.user.role,
      action: 'AUTH_REGISTERED',
      entityType: 'USER',
      entityId: result.user.id,
      metadata: { method: result.user.emailVerified ? 'EMAIL' : 'MOBILE' },
    });
    return result;
  }

  @Post('register/resend-otp')
  async resendRegistrationOtp(@Body() dto: ResendRegistrationOtpDto) {
    await this.authService.resendRegistrationOtp(dto.registrationId);
    return { message: 'OTP sent' };
  }

  // Also serves Profile's "verify the contact method I just added/changed"
  // step - both cases check whichever value (pending, if a change is in
  // flight, otherwise live) is currently outstanding for this method.
  // Widened from CITIZEN_ROLE-only to every role 2026-09-10 (docs/ADMIN_PANEL_ISSUES.md
  // Officer #2 follow-up, "richer Officer Profile") - this endpoint and the
  // three below it were already fully role-agnostic in AuthService (they
  // operate on whichever User row @CurrentUser() resolves to), only the
  // @Roles guard itself was CITIZEN-only; OfficerProfilePage.tsx now reuses
  // the same ContactMethodCard/ProfileDetailsCard components as the Citizen
  // Portal's ProfilePage.tsx against these same endpoints.
  @Post('verify-otp')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CITIZEN_ROLE, ...ALL_STAFF_ROLES)
  async verifyOtp(@CurrentUser() user: User, @Body() dto: VerifyOtpDto) {
    const updated = await this.authService.verifyOtp(user, dto.method, dto.code);
    await this.auditService.log({
      userId: user.id,
      userRole: user.role,
      action: 'AUTH_CONTACT_VERIFIED',
      entityType: 'USER',
      entityId: user.id,
      metadata: { method: dto.method },
    });
    return this.authService.toPublicUser(updated);
  }

  @Post('resend-otp')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CITIZEN_ROLE, ...ALL_STAFF_ROLES)
  async resendOtp(@CurrentUser() user: User, @Body() dto: ResendOtpDto) {
    await this.authService.resendOtp(user, dto.method);
    return { message: 'OTP sent' };
  }

  // Profile "add or change contact method" (docs/FRONTEND_UPGRADE_SPEC.md
  // §3) - AuthService decides add-vs-change from the user's current state,
  // not a flag this endpoint's caller sends.
  @Post('profile/contact')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CITIZEN_ROLE, ...ALL_STAFF_ROLES)
  async updateContact(@CurrentUser() user: User, @Body() dto: ContactDto) {
    const updated = await this.authService.addOrChangeContact(user, dto);
    await this.auditService.log({
      userId: user.id,
      userRole: user.role,
      action: 'AUTH_CONTACT_UPDATE_REQUESTED',
      entityType: 'USER',
      entityId: user.id,
      metadata: { method: dto.method },
    });
    return this.authService.toPublicUser(updated);
  }

  // Profile "more info, editable" (docs/FRONTEND_UPGRADE_SPEC.md follow-up) -
  // no OTP step, unlike updateContact above (see AuthService.updateProfileDetails).
  @Post('profile/details')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CITIZEN_ROLE, ...ALL_STAFF_ROLES)
  async updateProfileDetails(@CurrentUser() user: User, @Body() dto: ProfileDetailsDto) {
    const updated = await this.authService.updateProfileDetails(user, dto);
    await this.auditService.log({
      userId: user.id,
      userRole: user.role,
      action: 'AUTH_PROFILE_DETAILS_UPDATED',
      entityType: 'USER',
      entityId: user.id,
    });
    return this.authService.toPublicUser(updated);
  }

  // Lets the frontend rehydrate a session from a stored token on page load
  // (or reject an expired/invalid one) without re-sending credentials.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: { user: User }) {
    return this.authService.toPublicUser(req.user);
  }
}
