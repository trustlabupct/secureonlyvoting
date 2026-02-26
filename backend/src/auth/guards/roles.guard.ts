import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role, UserContext, RequestWithUser } from '../auth.interfaces';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No roles are required, access granted
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user: UserContext | undefined = request.user;

    if (!user || !user.roles || user.roles.length === 0) {
      // User is not authenticated or has no roles assigned
      throw new ForbiddenException(
        'User has no assigned roles or is not authenticated.',
      );
    }

    // Check if the user has at least one of the required roles
    const hasPermission = user.roles.some((role) =>
      requiredRoles.includes(role),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `User roles (${user.roles.join(', ')}) do not meet the required roles (${requiredRoles.join(', ')}).`,
      );
    }

    return true;
  }
}
