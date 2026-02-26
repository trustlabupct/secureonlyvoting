import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
  Matches,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { Role } from '../../auth/auth.interfaces';
import { SanitizeString } from '../../common/sanitizer';

export class CreateUserDto {
  @IsEmail()
  username: string; // Using email as username

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;

  @IsString()
  @IsOptional()
  @SanitizeString()
  name?: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @SanitizeString()
  name?: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  @IsOptional()
  password?: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}

// Internal DTO for service-level updates including MFA fields
export class PartialUpdateUserDto {
  @IsString()
  @IsOptional()
  @SanitizeString()
  name?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsBoolean()
  @IsOptional()
  mfaEnabled?: boolean;

  @IsString()
  @IsOptional()
  mfaSecret?: string | null;

  @IsArray()
  @IsOptional()
  mfaRecoveryCodes?: string[] | null;
}

export class LoginDto {
  @IsEmail()
  username: string;

  @IsString()
  @MinLength(1)
  password: string;
}
