import crypto from "crypto"
import { z } from "zod"
import { logAudit } from "./audit-logger"
// Removed import of UserSchema/User from ./auth
import { SignJWT } from "jose"

// User schema for validation - Moved here from auth.ts
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email().optional(),
  name: z.string(),
  certificateId: z.string().optional(),
  role: z.enum(["admin", "user"]),
  groups: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
  lastLogin: z.string().optional(), // Kept here
  failedLoginAttempts: z.number().optional(), // Kept here
  lockedUntil: z.string().optional(), // Kept here
  sessionId: z.string().optional(), // Added based on createSessionToken structure
})

export type User = z.infer<typeof UserSchema>


// Secret key for JWT signing - ensure this matches the one in auth.ts if used separately
// Or better, centralize secret management if needed elsewhere.
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key-at-least-32-chars-long")

// Mock database for users - in production, use a real database
export const users: User[] = [
  {
    id: "1",
    email: "admin@example.com",
    name: "Admin User",
    role: "admin",
    groups: ["administrators", "employees"],
    permissions: ["manage_polls", "view_all_results", "manage_users"],
  },
  {
    id: "2",
    email: "user@example.com",
    name: "Regular User",
    role: "user",
    groups: ["employees"],
    permissions: ["vote", "view_own_results"],
  },
  {
    id: "3",
    name: "Certificate User",
    certificateId: "cert123",
    role: "user",
    groups: ["employees", "executives"],
    permissions: ["vote", "view_own_results"],
  },
]

// Simple password hashing function - in production, use bcrypt
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex")
}

// Mock password database - in production, use a proper password hashing library
const passwordHashes: Record<string, string> = {
  "admin@example.com": hashPassword("admin123"),
  "user@example.com": hashPassword("user123"),
}


// Verify password with rate limiting and account locking
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const user = users.find((u) => u.email === email)

  // If user not found, return false but don't reveal this information
  if (!user) {
    await logAudit("LOGIN_FAILED", false, { reason: "User not found", email }, null, "auth", "User not found")
    return false
  }

  // Check if account is locked
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    await logAudit(
      "LOGIN_FAILED",
      false,
      { reason: "Account locked", email, lockedUntil: user.lockedUntil },
      user.id,
      "auth",
      "Account locked due to too many failed attempts"
    )
    return false
  }

  const storedHash = passwordHashes[email]
  if (!storedHash) return false // Should not happen if user exists, but good practice

  const inputHash = hashPassword(password)
  const isValid = storedHash === inputHash

  // Update failed login attempts
  if (!isValid) {
    // Increment failed attempts
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1

    // Lock account after 5 failed attempts
    if (user.failedLoginAttempts >= 5) {
      // Lock for 15 minutes
      const lockUntil = new Date()
      lockUntil.setMinutes(lockUntil.getMinutes() + 15)
      user.lockedUntil = lockUntil.toISOString()

      await logAudit(
        "ACCOUNT_LOCKED",
        false,
        { reason: "Too many failed attempts", email, failedAttempts: user.failedLoginAttempts },
        user.id,
        "auth",
        "Account locked due to too many failed login attempts"
      )
    } else {
      await logAudit(
        "LOGIN_FAILED",
        false,
        { reason: "Invalid password", email, failedAttempts: user.failedLoginAttempts },
        user.id,
        "auth",
        "Invalid password",
      )
    }
  } else {
    // Reset failed attempts on successful login
    user.failedLoginAttempts = 0
    user.lockedUntil = undefined
    user.lastLogin = new Date().toISOString()

    await logAudit("LOGIN_SUCCESS", true, { email }, user.id, "auth", null)
  }

  return isValid
}

// Create session token with enhanced security
export async function createSessionToken(user: User): Promise<string> {
  // Create a session ID for revocation purposes
  const sessionId = crypto.randomBytes(16).toString("hex")

  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    groups: user.groups || [],
    permissions: user.permissions || [],
    sessionId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h") // Token expires in 2 hours
    .setJti(sessionId) // Add a unique identifier for the token
    .sign(JWT_SECRET)

  // In a real implementation, store the sessionId in a database
  // for token revocation purposes

  return token
}

// Verify certificate
export function verifyCertificate(certificateId: string): User | null {
  // In a real implementation, you would verify the certificate against a CA
  // and extract the user information from it
  const user = users.find((u) => u.certificateId === certificateId)
  return user || null
}
// Revoke all sessions for a user (for password changes, security incidents)
export async function revokeAllSessions(userId: string, reason: string) {
  // In a real implementation, mark all sessions for this user as revoked in the database

  const user = users.find((u) => u.id === userId)
    if (user) {
      await logAudit(
        "SESSIONS_REVOKED",
        true,
        { userId, reason },
        userId,
        "auth",
        `All sessions revoked for user: ${reason}`,
      )
    }

  // Return success status
  return { success: true }
}
