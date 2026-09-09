import { Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto, ResendOtpDto } from './dto/verify-otp.dto';
import { ContactDto } from './dto/contact.dto';
import { ProfileDetailsDto } from './dto/profile-details.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { CurrentUser } from './current-user.decorator';
import { CITIZEN_ROLE } from './roles.constants';
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
  // Officer/Admin accounts stay admin-created via POST /users. Returns a
  // session immediately; the chosen contact method starts unverified (see
  // AuthService.register for why login isn't gated on that).
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    await this.auditService.log({
      userId: result.user.id,
      userRole: result.user.role,
      action: 'AUTH_REGISTERED',
      entityType: 'USER',
      entityId: result.user.id,
      metadata: { method: dto.method },
    });
    return result;
  }

  // Also serves Profile's "verify the contact method I just added/changed"
  // step - both cases check whichever value (pending, if a change is in
  // flight, otherwise live) is currently outstanding for this method.
  @Post('verify-otp')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CITIZEN_ROLE)
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
  @Roles(CITIZEN_ROLE)
  async resendOtp(@CurrentUser() user: User, @Body() dto: ResendOtpDto) {
    await this.authService.resendOtp(user, dto.method);
    return { message: 'OTP sent' };
  }

  // Profile "add or change contact method" (docs/FRONTEND_UPGRADE_SPEC.md
  // §3) - AuthService decides add-vs-change from the user's current state,
  // not a flag this endpoint's caller sends.
  @Post('profile/contact')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CITIZEN_ROLE)
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
  @Roles(CITIZEN_ROLE)
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
