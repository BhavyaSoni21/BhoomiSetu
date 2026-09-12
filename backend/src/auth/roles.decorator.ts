import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Declarative role allowlist, read by RolesGuard. Must be paired with
// JwtAuthGuard (which populates req.user) - a route decorated with @Roles
// alone enforces nothing on its own.
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
