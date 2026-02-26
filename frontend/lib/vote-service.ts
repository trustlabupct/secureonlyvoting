import type { User } from "./auth-node" // Corrected import path
import type { Vote, Poll } from "./types"
import { getPollById } from "./poll-service"
import { logAudit } from "./audit-logger"
import crypto from "crypto"
import { headers } from "next/headers" // Import headers function

// Mock database for votes
const votes: Vote[] = []

// Rate limiting cache to prevent spam
const rateLimitCache: Record<string, { count: number; lastReset: number }> = {}
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 5 // 5 votes per minute

// Vote attempt tracking for fraud detection
const voteAttemptTracking: Record<string, { attempts: number; lastAttempt: number; ips: Set<string> }> = {}

// Submit a vote with enhanced security and validation
export async function submitVote(
  pollId: string,
  voteValue: any,
  user: User,
  comment?: string,
  // request?: Request, // Remove request parameter
): Promise<{ success: boolean; message: string; voteId?: string }> {
  try {
    // Extract IP address using headers()
    const headersList = await headers() // Added await here
    const ipAddress = headersList.get("x-forwarded-for") || "unknown"

    // Check rate limiting
    const userRateKey = `${user.id}:${pollId}`
    const now = Date.now()

    if (!rateLimitCache[userRateKey]) {
      rateLimitCache[userRateKey] = { count: 0, lastReset: now }
    }

    const userRate = rateLimitCache[userRateKey]

    // Reset counter if window has passed
    if (now - userRate.lastReset > RATE_LIMIT_WINDOW) {
      userRate.count = 0
      userRate.lastReset = now
    }

    // Check if user has exceeded rate limit
    if (userRate.count >= RATE_LIMIT_MAX) {
      await logAudit(
        "VOTE_FAILED",
        false,
        { reason: "Rate limit exceeded", ipAddress },
        pollId,
        "poll",
        "Rate limit exceeded",
        // request, // Remove request argument
      )
      return { success: false, message: "You're voting too quickly. Please try again later." }
    }

    // Increment rate limit counter
    userRate.count++

    // Track vote attempts for fraud detection
    if (!voteAttemptTracking[user.id]) {
      voteAttemptTracking[user.id] = { attempts: 0, lastAttempt: now, ips: new Set() }
    }

    const tracking = voteAttemptTracking[user.id]
    tracking.attempts++
    tracking.lastAttempt = now
    tracking.ips.add(ipAddress)

    // Check for suspicious activity (multiple IPs or excessive attempts)
    if (tracking.ips.size > 3 || tracking.attempts > 20) {
      await logAudit(
        "SECURITY_EVENT",
        false,
        {
          reason: "Suspicious voting activity",
          userId: user.id,
          ipCount: tracking.ips.size,
          attemptCount: tracking.attempts,
          ips: Array.from(tracking.ips),
        },
        user.id,
        "user",
        "Suspicious voting activity detected",
        // request, // Remove request argument
      )

      // In a real system, you might want to temporarily lock the account
      // or require additional verification
    }

    const poll = getPollById(pollId)

    if (!poll) {
      await logAudit("VOTE_FAILED", false, { reason: "Poll not found" }, pollId, "poll", "Poll not found" /* Remove request */)
      return { success: false, message: "Poll not found" }
    }

    // Check if poll is active
    const now2 = new Date()
    const startDate = new Date(poll.startDate)
    const endDate = new Date(poll.endDate)

    if (now2 < startDate) {
      await logAudit(
        "VOTE_FAILED",
        false,
        { reason: "Poll not active yet" },
        pollId,
        "poll",
        "Poll not active yet",
        // request, // Remove request argument
      )
      return { success: false, message: "This poll is not yet active" }
    }

    if (now2 > endDate) {
      await logAudit("VOTE_FAILED", false, { reason: "Poll ended" }, pollId, "poll", "Poll ended" /* Remove request */)
      return { success: false, message: "This poll has ended" }
    }

    // Check if user has already voted
    const existingVote = votes.find((v) => v.pollId === pollId && v.userId === user.id)

    if (existingVote) {
      await logAudit("VOTE_FAILED", false, { reason: "Already voted" }, pollId, "poll", "User already voted" /* Remove request */)
      return { success: false, message: "You have already voted in this poll" }
    }

    // Check user permissions for this poll
    if (
      (poll.visibility === "admin-only" && user.role !== "admin") ||
      (poll.visibility === "specific-groups" &&
        poll.allowedGroups &&
        !poll.allowedGroups.some((group) => user.groups?.includes(group)))
    ) {
      await logAudit(
        "VOTE_FAILED",
        false,
        { reason: "Permission denied" },
        pollId,
        "poll",
        "User does not have permission to vote in this poll",
        // request, // Remove request argument
      )
      return { success: false, message: "You do not have permission to vote in this poll" }
    }

    // Validate vote value based on voting mechanism
    const validationResult = validateVote(poll.votingMechanism, voteValue, poll)
    if (!validationResult.valid) {
      await logAudit(
        "VOTE_FAILED",
        false,
        { reason: "Invalid vote value", details: validationResult.error },
        pollId,
        "poll",
        validationResult.error,
        // request, // Remove request argument
      )
      return { success: false, message: validationResult.error || "Invalid vote value" }
    }

    // Validate comment if provided
    if (comment && (!poll.allowComments || comment.length > 1000)) {
      await logAudit(
        "VOTE_FAILED",
        false,
        { reason: "Invalid comment" },
        pollId,
        "poll",
        "Comments are not allowed or comment is too long",
        // request, // Remove request argument
      )
      return {
        success: false,
        message: poll.allowComments
          ? "Comment is too long (maximum 1000 characters)"
          : "Comments are not allowed for this poll",
      }
    }

    // Generate a secure vote ID with cryptographic randomness
    const voteId = `vote-${crypto.randomBytes(16).toString("hex")}`

    // Create the vote object
    const vote: Vote = {
      id: voteId,
      pollId,
      value: voteValue,
      comment: comment && poll.allowComments ? comment : undefined,
      timestamp: new Date().toISOString(),
      // Only include user information if the poll is not anonymous
      userId: user.id,
      userName: poll.anonymous ? undefined : user.name,
      userEmail: poll.anonymous ? undefined : user.email,
    }

    // In a real implementation, you would save the vote to a database
    // with proper transaction handling to ensure data integrity
    votes.push(vote)

    // Increment the poll's vote count
    poll.totalVotes++

    // Log the successful vote
    await logAudit(
      "VOTE_SUBMITTED",
      true,
      {
        votingMechanism: poll.votingMechanism,
        // Don't log the actual vote value for anonymous polls
        voteValue: poll.anonymous ? "REDACTED" : voteValue,
        pollId,
        pollTitle: poll.title,
      },
      pollId,
      "poll",
      undefined,
      // request, // Remove request argument
    )

    return {
      success: true,
      message: "Vote submitted successfully",
      voteId,
    }
  } catch (error) {
    // Log the error
    console.error("Error submitting vote:", error)

    await logAudit(
      "VOTE_FAILED",
      false,
      { reason: "Server error" },
      pollId,
      "poll",
      error instanceof Error ? error.message : "Unknown error",
      // request, // Remove request argument
    )

    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    }
  }
}

// Validate vote based on voting mechanism with detailed error messages
function validateVote(mechanism: string, value: any, poll: Poll): { valid: boolean; error?: string } {
  try {
    switch (mechanism) {
      case "yes-no":
        if (value !== "yes" && value !== "no") {
          return { valid: false, error: "Vote must be either 'yes' or 'no'" }
        }
        return { valid: true }

      case "multiple-choice":
        if (!poll.options?.includes(value)) {
          return { valid: false, error: "Selected option is not valid for this poll" }
        }
        return { valid: true }

      case "multiple-selection":
        if (!Array.isArray(value)) {
          return { valid: false, error: "Vote must be an array of selected options" }
        }
        if (value.length === 0) {
          return { valid: false, error: "You must select at least one option" }
        }
        if (!value.every((option) => poll.options?.includes(option))) {
          return { valid: false, error: "One or more selected options are not valid for this poll" }
        }
        return { valid: true }

      case "rating":
        if (typeof value !== "number") {
          return { valid: false, error: "Rating must be a number" }
        }
        if (!poll.ratingScale) {
          return { valid: false, error: "Rating scale is not defined for this poll" }
        }
        if (value < poll.ratingScale.min || value > poll.ratingScale.max) {
          return {
            valid: false,
            error: `Rating must be between ${poll.ratingScale.min} and ${poll.ratingScale.max}`,
          }
        }
        // Check if the rating matches the step size
        const step = poll.ratingScale.step || 1
        const isValidStep =
          (value - poll.ratingScale.min) % step < 0.0001 || (value - poll.ratingScale.min) % step > step - 0.0001
        if (!isValidStep) {
          return {
            valid: false,
            error: `Rating must be in increments of ${step}`,
          }
        }
        return { valid: true }

      case "ranking":
        if (!Array.isArray(value)) {
          return { valid: false, error: "Ranking must be an array of options" }
        }
        if (!poll.options) {
          return { valid: false, error: "Poll options are not defined" }
        }
        if (value.length !== poll.options.length) {
          return {
            valid: false,
            error: `Ranking must include all ${poll.options.length} options`,
          }
        }
        if (!value.every((option) => poll.options?.includes(option))) {
          return { valid: false, error: "Ranking contains invalid options" }
        }
        if (new Set(value).size !== poll.options.length) {
          return { valid: false, error: "Ranking contains duplicate options" }
        }
        return { valid: true }

      case "text-response":
        if (typeof value !== "string") {
          return { valid: false, error: "Response must be text" }
        }
        if (value.trim() === "") {
          return { valid: false, error: "Response cannot be empty" }
        }
        if (value.length > 5000) {
          return { valid: false, error: "Response is too long (maximum 5000 characters)" }
        }
        return { valid: true }

      default:
        return { valid: false, error: "Unknown voting mechanism" }
    }
  } catch (error) {
    console.error("Error validating vote:", error)
    return { valid: false, error: "Error validating vote" }
  }
}

// Get votes for a poll with access control
export function getPollVotes(pollId: string, userRole: string): Vote[] {
  const poll = getPollById(pollId)

  if (!poll) {
    return []
  }

  // Filter votes for this poll
  const pollVotes = votes.filter((vote) => vote.pollId === pollId)

  // If poll is ended and results are visible, or user is admin, return votes
  if ((poll.status === "ended" && poll.showResults) || userRole === "admin") {
    return pollVotes
  }

  return []
}

// Check if a user has voted in a poll
export function hasUserVoted(pollId: string, userId: string): boolean {
  return votes.some((vote) => vote.pollId === pollId && vote.userId === userId)
}

// Get vote by ID with access control
export async function getVoteById(voteId: string, user: User): Promise<Vote | null> {
  const vote = votes.find((v) => v.id === voteId)

  if (!vote) return null

  // Check if user has access to this vote
  if (user.role === "admin" || vote.userId === user.id) {
    return vote
  }

  // Check if the poll allows viewing votes
  const poll = getPollById(vote.pollId)
  if (poll && !poll.anonymous && poll.showResults && poll.status === "ended") {
    return vote
  }

  // Log unauthorized access attempt
  await logAudit(
    "UNAUTHORIZED_ACCESS",
    false,
    { resource: "vote", voteId },
    voteId,
    "vote",
    "Attempted to access vote without permission",
  )

  return null
}

// Get vote statistics for a poll
export function getVoteStatistics(pollId: string): any {
  const poll = getPollById(pollId)
  if (!poll) return null

  const pollVotes = votes.filter((vote) => vote.pollId === pollId)

  // Calculate basic statistics
  const totalVotes = pollVotes.length
  const firstVoteTime = pollVotes.length > 0 ? Math.min(...pollVotes.map((v) => new Date(v.timestamp).getTime())) : null
  const lastVoteTime = pollVotes.length > 0 ? Math.max(...pollVotes.map((v) => new Date(v.timestamp).getTime())) : null

  // Calculate vote distribution over time
  const voteTimeline: Record<string, number> = {}

  if (pollVotes.length > 0) {
    // Group by hour
    pollVotes.forEach((vote) => {
      const date = new Date(vote.timestamp)
      const hourKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}:00`

      if (!voteTimeline[hourKey]) {
        voteTimeline[hourKey] = 0
      }

      voteTimeline[hourKey]++
    })
  }

  return {
    totalVotes,
    firstVoteTime: firstVoteTime ? new Date(firstVoteTime).toISOString() : null,
    lastVoteTime: lastVoteTime ? new Date(lastVoteTime).toISOString() : null,
    voteTimeline,
    // Don't include individual votes to respect anonymity
  }
}

// Create a comprehensive security dashboard component for administrators
export async function createSecurityAuditReport(pollId: string): Promise<any> {
  const poll = getPollById(pollId)
  if (!poll) return { success: false, message: "Poll not found" }

  const pollVotes = votes.filter((vote) => vote.pollId === pollId)

  // Get all audit logs related to this poll
  const { logAudit, getResourceAuditLogs } = await import("./audit-logger")
  const auditResult = await getResourceAuditLogs(pollId, "poll")

  // Log this security audit
  await logAudit("ADMIN_ACTION", true, { action: "Security audit", pollId, pollTitle: poll.title }, pollId, "poll")

  // Calculate security metrics
  const failedVoteAttempts = auditResult.logs.filter((log) => log.action === "VOTE_FAILED").length

  const suspiciousActivities = auditResult.logs.filter((log) => log.severity === "critical" || log.severity === "error")

  // Identify potential duplicate votes (same IP different users)
  const ipToUserMap: Record<string, Set<string>> = {}
  auditResult.logs.forEach((log) => {
    if (log.ipAddress && log.userId) {
      if (!ipToUserMap[log.ipAddress]) {
        ipToUserMap[log.ipAddress] = new Set()
      }
      ipToUserMap[log.ipAddress].add(log.userId)
    }
  })

  const suspiciousIPs = Object.entries(ipToUserMap)
    .filter(([ip, users]) => users.size > 1)
    .map(([ip, users]) => ({
      ip,
      userCount: users.size,
      users: Array.from(users),
    }))

  return {
    success: true,
    pollId,
    pollTitle: poll.title,
    totalVotes: pollVotes.length,
    securityMetrics: {
      failedVoteAttempts,
      suspiciousActivitiesCount: suspiciousActivities.length,
      suspiciousIPs,
      suspiciousActivities: suspiciousActivities.map((log) => ({
        id: log.id,
        timestamp: log.timestamp,
        action: log.action,
        userId: log.userId,
        ipAddress: log.ipAddress,
        details: log.details,
        errorMessage: log.errorMessage,
      })),
    },
    auditLogSummary: {
      totalLogs: auditResult.total,
      voteSubmissions: auditResult.logs.filter((log) => log.action === "VOTE_SUBMITTED").length,
      resultsViewed: auditResult.logs.filter((log) => log.action === "RESULTS_VIEWED").length,
    },
  }
}
