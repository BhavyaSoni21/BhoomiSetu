import { Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
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
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
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

  // Lets the frontend rehydrate a session from a stored token on page load
  // (or reject an expired/invalid one) without re-sending credentials.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: { user: User }) {
    return this.authService.toPublicUser(req.user);
  }
}
