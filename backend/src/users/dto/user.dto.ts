import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { ALL_STAFF_ROLES } from '../../auth/roles.constants';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
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
