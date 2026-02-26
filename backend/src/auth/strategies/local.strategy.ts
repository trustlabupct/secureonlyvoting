import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../auth.service'; // Corrected path
import { User } from '../../users/entities/user.entity'; // This path is correct (../../users/entities/user.entity)

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    // Passport-local expects 'username' and 'password' fields by default
    super({ usernameField: 'username' });
  }

  /**
   * Passport automatically calls this method with credentials from the request body.
   * @param username The username extracted from the request.
   * @param password The password extracted from the request.
   * @returns The validated user object (without password hash).
   * @throws UnauthorizedException if validation fails.
   */
  async validate(
    username: string,
    password: string,
  ): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.authService.validateUser(username, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user; // This user object will be attached to req.user
  }
}
