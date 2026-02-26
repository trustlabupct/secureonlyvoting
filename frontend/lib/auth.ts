import { cookies } from "next/headers"
import { jwtVerify } from "jose" // SignJWT is not needed here anymore
import { z } from "zod" // Keep Zod if UserSchema is used for validation within verifySessionToken payload, otherwise remove
// Note: Node.js specific functions (users, password hashing, etc.) moved to lib/auth-node.ts
import { redirect } from "next/navigation"
import { logAudit } from "./audit-logger" // Keep for logout/revoke
import type { User } from "./auth-node" // Import User type from auth-node.ts

// Secret key for JWT signing - MUST match the one in auth-node.ts
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key-at-least-32-chars-long")

// Removed: UserSchema definition (now in auth-node.ts)
// Removed: User type definition (now in auth-node.ts)

// Verify session token with enhanced security
export async function verifySessionToken(token: string): Promise<User | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      clockTolerance: 15, // 15 seconds of clock skew tolerance
    })

    // In a real implementation, check if the sessionId has been revoked
    // const sessionId = payload.jti
    // if (isSessionRevoked(sessionId)) return null

    return payload as unknown as User
  } catch (error) {
    return null
  }
}

// Get current user from session
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies() // Add await
  const token = cookieStore.get("session")?.value

  if (!token) {
    return null
  }

  return verifySessionToken(token)
}

// Check if user is authenticated
export async function requireAuth() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return user
}

// Check if user has specific permission
export async function checkPermission(permission: string): Promise<boolean> {
  const user = await getCurrentUser()

  if (!user) return false

  // Admins have all permissions
  if (user.role === "admin") return true

  // Check user's specific permissions
  return user.permissions?.includes(permission) || false
}

// Check if user is in a specific group
export async function checkGroup(group: string): Promise<boolean> {
  const user = await getCurrentUser()

  if (!user) return false

  return user.groups?.includes(group) || false
}

// Removed: verifyCertificate function

// Logout action with audit logging
export async function logout(/* request?: Request */) { // Removed request parameter
  const user = await getCurrentUser()

  if (user) {
    await logAudit("LOGOUT", true, { userId: user.id }, user.id, "auth", null /* Removed request */)
  }

  const cookieStore = await cookies() // Add await
  cookieStore.delete("session")
  redirect("/login")
}

// Removed: revokeAllSessions function (moved to auth-node.ts)
