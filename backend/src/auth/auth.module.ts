import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JWT_SECRET } from './jwt.constants';
import { PendingRegistration } from './pending-registration.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PendingRegistration]),
    UsersModule,
    AuditModule,
    NotificationsModule,
    PassportModule,
    JwtModule.register({
      secret: JWT_SECRET,
      // No expiresIn - per the user's explicit "the session should not log
      // out until the user presses logout", a signed-in session must stay
      // valid indefinitely; the frontend's own 401 handler (apiService.ts)
      // already force-redirects to /login on ANY expired/invalid token, so
      // a fixed expiry (this used to be 24h) was silently ending sessions
      // out from under an actively-working user. Signing out is now purely
      // client-side (useLogout clears the token), the only thing that ends
      // a session.
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
