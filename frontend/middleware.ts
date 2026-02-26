import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifySessionToken } from "./lib/auth"

// Define which paths require authentication
const protectedPaths = ["/dashboard", "/polls", "/admin"]

// Define admin-only paths
const adminOnlyPaths = ["/admin"]

// Define rate limiting cache (in a real app, use Redis or similar)
const rateLimitCache: Record<string, { count: number; lastReset: number }> = {}
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = {
  login: 10, // 10 login attempts per minute
  vote: 5, // 5 vote submissions per minute
  general: 60, // 60 general requests per minute
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  // Get IP address using standard headers (request.ip is deprecated/removed)
  const ip = request.headers.get("x-forwarded-for") || "unknown"
  const response = NextResponse.next()

  // Add security headers to all responses
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

  // Add Content-Security-Policy for enhanced security
  // Allow 'unsafe-eval' in development for tools like Fast Refresh
  const scriptSrc = process.env.NODE_ENV === 'development'
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : "'self' 'unsafe-inline'";

  // Allow connections to backend API
  const backendUrl = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3001' 
    : "'self'"; // In production, adjust this to your actual backend URL

  response.headers.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ${backendUrl};`,
  )

  // Apply rate limiting based on path
  const rateLimitKey = getRateLimitKey(path, ip)
  if (rateLimitKey) {
    const now = Date.now()

    if (!rateLimitCache[rateLimitKey]) {
      rateLimitCache[rateLimitKey] = { count: 0, lastReset: now }
    }

    const rateLimit = rateLimitCache[rateLimitKey]

    // Reset counter if window has passed
    if (now - rateLimit.lastReset > RATE_LIMIT_WINDOW) {
      rateLimit.count = 0
      rateLimit.lastReset = now
    }

    // Increment counter
    rateLimit.count++

    // Check if rate limit exceeded
    const maxRequests = getMaxRequestsForPath(path)
    if (rateLimit.count > maxRequests) {
      return new NextResponse(JSON.stringify({ error: "Too many requests, please try again later" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      })
    }
  }

  // Check if the path is protected
  const isProtectedPath = protectedPaths.some((prefix) => path.startsWith(prefix))

  if (!isProtectedPath) {
    return response
  }

  // Get the session token from cookies
  const sessionToken = request.cookies.get("session")?.value

  // If there's no session token, redirect to login
  if (!sessionToken) {
    const url = new URL("/login", request.url)
    url.searchParams.set("callbackUrl", path)
    return NextResponse.redirect(url)
  }

  // Verify the session token
  const user = await verifySessionToken(sessionToken)

  // If the token is invalid, redirect to login
  if (!user) {
    const url = new URL("/login", request.url)
    url.searchParams.set("callbackUrl", path)
    return NextResponse.redirect(url)
  }

  // Check for admin-only paths
  const isAdminOnlyPath = adminOnlyPaths.some((prefix) => path.startsWith(prefix))
  if (isAdminOnlyPath && user.role !== "admin") {
    // Log unauthorized access attempt
    try {
      const { logAudit } = await import("./lib/audit-logger")
      await logAudit(
        "UNAUTHORIZED_ACCESS",
        false,
        { path, requiredRole: "admin", userRole: user.role },
        null,
        "path",
        "Attempted to access admin-only path without admin privileges"
      )
    } catch (error) {
      console.error("Failed to log unauthorized access:", error)
    }

    // Redirect to dashboard with access denied message
    const url = new URL("/dashboard", request.url)
    url.searchParams.set("accessDenied", "true")
    return NextResponse.redirect(url)
  }

  // Add user info to request headers for use in server components
  response.headers.set("X-User-ID", user.id)
  response.headers.set("X-User-Role", user.role)

  // Log successful access
  try {
    const { logAudit } = await import("./lib/audit-logger")
    await logAudit("PATH_ACCESS", true, { path }, user.id, "path", null)
  } catch (error) {
    console.error("Failed to log path access:", error)
  }

  return response
}

// Helper function to determine rate limit key based on path
function getRateLimitKey(path: string, ip: string): string | null {
  if (path.startsWith("/login") || path.includes("/auth")) {
    return `login:${ip}`
  }

  // Apply strict rate limiting to account-related endpoints (same as auth)
  if (path.startsWith("/account")) {
    return `login:${ip}`
  }

  if (path.includes("/vote") || (path.includes("/polls") && path.includes("submit"))) {
    return `vote:${ip}`
  }

  return `general:${ip}`
}

// Helper function to get max requests based on path
function getMaxRequestsForPath(path: string): number {
  if (path.startsWith("/login") || path.includes("/auth")) {
    return RATE_LIMIT_MAX.login
  }

  // Apply strict rate limiting to account-related endpoints (5 requests per minute)
  if (path.startsWith("/account")) {
    return RATE_LIMIT_MAX.vote // Use vote limit (5 requests per minute) for account operations
  }

  if (path.includes("/vote") || (path.includes("/polls") && path.includes("submit"))) {
    return RATE_LIMIT_MAX.vote
  }

  return RATE_LIMIT_MAX.general
}

// Configure the middleware to run on all paths
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
