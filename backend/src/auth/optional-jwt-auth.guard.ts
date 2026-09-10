import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Same 'jwt' strategy as JwtAuthGuard, but never rejects the request - it
// attaches req.user when a valid bearer token is present and just leaves it
// unset otherwise, for routes that stay public by default (an anonymous
// visitor can still call them) but need to know who's asking to decide what
// to include in the response, e.g. Parcel 360's owner-only department
// fields (ParcelsController.getParcel360).
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(_err: unknown, user: TUser): TUser {
    return user;
  }
}
