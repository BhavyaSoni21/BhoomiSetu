import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { JWT_SECRET } from './jwt.constants';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  // Absent on a token minted before this claim existed - treated as 0
  // below, same as a freshly-created User's own tokenVersion default, so an
  // already-issued token isn't retroactively invalidated by this change.
  tokenVersion?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  // Return value becomes `req.user` on any route behind JwtAuthGuard. Looks
  // the user up fresh on every request (rather than trusting the payload
  // alone) so a deleted/changed account stops working immediately instead of
  // only once its token happens to expire.
  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    if ((payload.tokenVersion ?? 0) !== user.tokenVersion) throw new UnauthorizedException();
    return user;
  }
}
