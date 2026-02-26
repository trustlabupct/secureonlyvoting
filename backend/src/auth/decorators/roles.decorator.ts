import { SetMetadata } from '@nestjs/common';
import { Role } from '../auth.interfaces'; // Import the Role enum

export const ROLES_KEY = 'roles';

/**
 * Decorator to assign required roles to a route handler.
 * @param roles - An array of Role enum values.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
