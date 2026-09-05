import { TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User } from '../../src/users/user.entity';

// Shared by every e2e spec that hits a route behind RolesGuard
// (docs/FEATURE_AUDIT.md §8 item 5). Mints a real JWT the same way
// AuthService.login() does, but skips the bcrypt/login round trip - the
// password is never checked by anything downstream of this, since
// JwtStrategy looks the user up by id, not by re-verifying credentials.
let counter = 0;

export async function createAuthenticatedUser(
  moduleFixture: TestingModule,
  role: string,
): Promise<{ user: User; token: string; authHeader: string }> {
  const userRepository: Repository<User> = moduleFixture.get(getRepositoryToken(User));
  const jwtService: JwtService = moduleFixture.get(JwtService);

  counter += 1;
  const user = await userRepository.save({
    email: `rbac-test-${role.toLowerCase()}-${counter}@test.gov.in`,
    passwordHash: 'not-used-by-this-helper',
    name: `Test ${role}`,
    role,
  });

  const token = jwtService.sign({ sub: user.id, email: user.email, role: user.role });
  return { user, token, authHeader: `Bearer ${token}` };
}
