import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { User } from '../users/user.entity';

// Always run after JwtAuthGuard (see every @UseGuards(JwtAuthGuard,
// RolesGuard) call site) - relies on req.user already being populated.
// Returning false here becomes a 403 automatically (Nest's CanActivate
// default), distinct from JwtAuthGuard's 401 for "not authenticated at all".
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: User }>();
    return !!user && requiredRoles.includes(user.role);
  }
}
