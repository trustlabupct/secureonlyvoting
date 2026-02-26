"use server"

import { getCurrentUser } from "./auth"
import { headers } from "next/headers" // Import headers function

type AuditAction =
  | "VOTE_SUBMITTED"
  | "VOTE_FAILED"
  | "VOTE_MODIFIED"
  | "VOTE_DELETED"
  | "POLL_CREATED"
  | "POLL_MODIFIED"
  | "POLL_DELETED"
  | "USER_LOGIN"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "ACCOUNT_LOCKED"
  | "SESSIONS_REVOKED"
  | "UNAUTHORIZED_ACCESS"
  | "PATH_ACCESS"
  | "RESULTS_VIEWED"
  | "ADMIN_ACTION"
  | "SECURITY_EVENT"
  | "CONFIGURATION_CHANGED"

interface AuditLogEntry {
  id: string
  timestamp: string
  userId: string
  userName?: string
  userRole: string
  userGroups?: string[]
  action: AuditAction
  resourceId?: string
  resourceType?: string
  details?: any
  ipAddress?: string
  userAgent?: string
  requestMethod?: string
  requestPath?: string
  success: boolean
  errorMessage?: string
  severity: "info" | "warning" | "error" | "critical"
}

// In a production environment, this would write to a secure database or log service
const auditLogs: AuditLogEntry[] = []

// Determine severity based on action and success
function determineSeverity(action: AuditAction, success: boolean): "info" | "warning" | "error" | "critical" {
  // Critical events
  if (
    action === "SECURITY_EVENT" ||
    action === "ACCOUNT_LOCKED" ||
    action === "SESSIONS_REVOKED" ||
    (action === "UNAUTHORIZED_ACCESS" && !success)
  ) {
    return "critical"
  }

  // Error events
  if (
    (action === "VOTE_FAILED" && !success) ||
    (action === "LOGIN_FAILED" && !success) ||
    (action === "POLL_DELETED" && !success)
  ) {
    return "error"
  }

  // Warning events
  if (
    action === "CONFIGURATION_CHANGED" ||
    action === "POLL_MODIFIED" ||
    (action === "LOGIN_FAILED" && success) // Successful login after previous failures
  ) {
    return "warning"
  }

  // Info events (default)
  return "info"
}

export async function logAudit(
  action: AuditAction,
  success: boolean,
  details?: any,
  resourceId?: string | null,
  resourceType?: string,
  errorMessage?: string | null,
  // request?: Request, // Remove request parameter
) {
  try {
    const user = await getCurrentUser()

    // Generate a unique ID in both Node and Edge runtimes
    const logId =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`

    // Extract request information using headers()
    const headersList = await headers() // Added await
    const ipAddress = headersList.get("x-forwarded-for") || "unknown"
    const userAgent = headersList.get("user-agent") || "unknown"
    // Request method and path are not directly available via headers(), might need alternative approach if needed
    const requestMethod = "unknown" // Placeholder
    const requestPath = "unknown" // Placeholder

    const logEntry: AuditLogEntry = {
      id: logId,
      timestamp: new Date().toISOString(),
      userId: user?.id || "unauthenticated",
      userName: user?.name,
      userRole: user?.role || "none",
      userGroups: user?.groups,
      action,
      resourceId: resourceId || undefined,
      resourceType,
      details,
      ipAddress,
      userAgent,
      requestMethod,
      requestPath,
      success,
      errorMessage: errorMessage || undefined,
      severity: determineSeverity(action, success),
    }

    // In production, this would be an async write to a database or log service
    auditLogs.push(logEntry)

    // For critical security events, you might want to alert administrators
    if (logEntry.severity === "critical") {
      // In production, this would trigger an alert
      console.warn(
        `SECURITY ALERT: ${action} by ${logEntry.userName || logEntry.userId} - ${errorMessage || "No details"}`,
      )

      // In production, you might want to send an email, SMS, or other notification
      // await sendSecurityAlert(logEntry)
    }

    return logId
  } catch (error) {
    // Fail safe - log errors to server logs but don't break the application
    console.error("Failed to create audit log:", error)
    return null
  }
}

// For admin access to audit logs with pagination and advanced filtering
export async function getAuditLogs(
  page = 1,
  pageSize = 50,
  filters?: {
    userId?: string
    action?: AuditAction
    resourceId?: string
    resourceType?: string
    startDate?: string
    endDate?: string
    success?: boolean
    severity?: "info" | "warning" | "error" | "critical"
    ipAddress?: string
    searchTerm?: string
  },
) {
  const user = await getCurrentUser()

  // Only admins can access audit logs
  if (!user || user.role !== "admin") {
    return { logs: [], total: 0, page, pageSize }
  }

  // Log this access to audit logs
  await logAudit("ADMIN_ACTION", true, { action: "View audit logs", filters }, null, "audit_logs" /* Removed request */)

  let filteredLogs = [...auditLogs]

  // Apply filters
  if (filters) {
    if (filters.userId) {
      filteredLogs = filteredLogs.filter((log) => log.userId === filters.userId)
    }
    if (filters.action) {
      filteredLogs = filteredLogs.filter((log) => log.action === filters.action)
    }
    if (filters.resourceId) {
      filteredLogs = filteredLogs.filter((log) => log.resourceId === filters.resourceId)
    }
    if (filters.resourceType) {
      filteredLogs = filteredLogs.filter((log) => log.resourceType === filters.resourceType)
    }
    if (filters.startDate) {
      const startDate = new Date(filters.startDate)
      filteredLogs = filteredLogs.filter((log) => new Date(log.timestamp) >= startDate)
    }
    if (filters.endDate) {
      const endDate = new Date(filters.endDate)
      filteredLogs = filteredLogs.filter((log) => new Date(log.timestamp) <= endDate)
    }
    if (filters.success !== undefined) {
      filteredLogs = filteredLogs.filter((log) => log.success === filters.success)
    }
    if (filters.severity) {
      filteredLogs = filteredLogs.filter((log) => log.severity === filters.severity)
    }
    if (filters.ipAddress) {
      filteredLogs = filteredLogs.filter((log) => log.ipAddress?.includes(filters.ipAddress!))
    }
    if (filters.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase()
      filteredLogs = filteredLogs.filter((log) => {
        return (
          log.userName?.toLowerCase().includes(searchTerm) ||
          log.userId.toLowerCase().includes(searchTerm) ||
          log.action.toLowerCase().includes(searchTerm) ||
          log.resourceId?.toLowerCase().includes(searchTerm) ||
          log.errorMessage?.toLowerCase().includes(searchTerm) ||
          JSON.stringify(log.details).toLowerCase().includes(searchTerm)
        )
      })
    }
  }

  // Sort by timestamp descending (newest first)
  filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const total = filteredLogs.length
  const start = (page - 1) * pageSize
  const paginatedLogs = filteredLogs.slice(start, start + pageSize)

  return { logs: paginatedLogs, total, page, pageSize }
}

// Get audit logs for a specific resource
export async function getResourceAuditLogs(resourceId: string, resourceType: string) {
  const user = await getCurrentUser()

  // Only admins can access audit logs
  if (!user || user.role !== "admin") {
    return { logs: [], total: 0 }
  }

  // Filter logs for this resource
  const resourceLogs = auditLogs.filter((log) => log.resourceId === resourceId && log.resourceType === resourceType)

  // Sort by timestamp descending (newest first)
  resourceLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return { logs: resourceLogs, total: resourceLogs.length }
}

// Get security events for monitoring
export async function getSecurityEvents(hoursBack = 24) {
  const user = await getCurrentUser()

  // Only admins can access security events
  if (!user || user.role !== "admin") {
    return { events: [], total: 0 }
  }

  const cutoffTime = new Date()
  cutoffTime.setHours(cutoffTime.getHours() - hoursBack)

  // Filter for security-related events
  const securityEvents = auditLogs.filter(
    (log) =>
      new Date(log.timestamp) >= cutoffTime &&
      (log.severity === "critical" || log.severity === "error" || log.action.includes("SECURITY")),
  )

  // Sort by timestamp descending (newest first)
  securityEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return { events: securityEvents, total: securityEvents.length }
}

// Export audit logs (for compliance and backup)
export async function exportAuditLogs(startDate: string, endDate: string, format: "json" | "csv" = "json") {
  const user = await getCurrentUser()

  // Only admins can export audit logs
  if (!user || user.role !== "admin") {
    return { success: false, message: "Unauthorized" }
  }

  // Log this export
  await logAudit("ADMIN_ACTION", true, { action: "Export audit logs", startDate, endDate, format }, null, "audit_logs")

  const start = new Date(startDate)
  const end = new Date(endDate)

  // Filter logs by date range
  const logsToExport = auditLogs.filter((log) => new Date(log.timestamp) >= start && new Date(log.timestamp) <= end)

  if (format === "csv") {
    // In a real implementation, convert to CSV
    return {
      success: true,
      format: "csv",
      filename: `audit_logs_${startDate}_to_${endDate}.csv`,
      data: "csv data would be here", // In reality, this would be the CSV content
    }
  }

  return {
    success: true,
    format: "json",
    filename: `audit_logs_${startDate}_to_${endDate}.json`,
    data: logsToExport,
  }
}
