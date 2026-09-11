import { IsEmail, IsIn, IsString, Matches, MinLength } from 'class-validator';
import { ALL_STAFF_ROLES } from '../../auth/roles.constants';

export class CreateUserDto {
  @IsEmail()
  email: string;

  // KNOWN_RISKS.md MED-10, same rule as citizen self-registration
  // (auth/dto/register.dto.ts) - officer/admin accounts are admin-created
  // through this DTO, not exempt from the same baseline.
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;

  @IsString()
  name: string;

  @IsIn([...ALL_STAFF_ROLES])
  role: string;
}

export class UpdateUserRoleDto {
  @IsIn([...ALL_STAFF_ROLES])
  role: string;
}
