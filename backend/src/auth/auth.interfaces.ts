import { Request } from 'express';

// Define standard roles
export enum Role {
  USER = 'user',
  ADMIN = 'admin',
  // Add other roles as needed, e.g., EDITOR, MODERATOR
}

// Define the structure of the JWT payload
export interface JwtPayload {
  username: string;
  sub: string;
  role: string;
  tokenId: string;
  type: 'access' | 'refresh';
  name?: string;
  sessionId?: string;
}

// Define the structure of the user object that will be attached to the request
export interface UserContext {
  id: string;
  username: string;
  name?: string;
  role: Role; // Primary role
  roles: Role[]; // Array of all roles the user has
  groups?: string[];
  tokenId?: string; // Token identifier for blacklisting
  sessionId?: string; // Session identifier
}

/**
 * Extends the Express Request object to include the authenticated user context
 * and potentially other request-scoped objects like a processed poll.
 */
export interface RequestWithUser extends Request {
  user: UserContext;
  poll?: any; // Replace 'any' with a more specific type like PollWithPermissions if available
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string;
    username: string;
    name: string | null;
    role: string;
  };
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

// MFA-related interfaces and DTOs
export interface MFASetupResponse {
  qrCodeUrl: string;
  setupKey: string;
  backupCodes?: string[];
}

export interface MFAVerifyRequest {
  token: string;
}

export interface MFAEnableRequest {
  token: string;
}

export interface MFALoginResponse {
  requiresMFA: boolean;
  tempToken?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: {
    id: string;
    username: string;
    name: string | null;
    role: string;
  };
}

export interface MFALoginRequest {
  tempToken: string;
  token: string;
}

export interface RecoveryCodeRequest {
  tempToken: string;
  recoveryCode: string;
}

export interface GenerateRecoveryCodesResponse {
  recoveryCodes: string[];
}
