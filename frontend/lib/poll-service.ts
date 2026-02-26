import type { AdminAccount, Poll } from "./types"
import type { User } from "./auth-node"

// Mock admin accounts
const adminAccounts: AdminAccount[] = [
  {
    id: "admin1",
    name: "Election Committee",
    email: "elections@example.com",
    department: "Governance",
    polls: [],
  },
  {
    id: "admin2",
    name: "HR Department",
    email: "hr@example.com",
    department: "Human Resources",
    polls: [],
  },
  {
    id: "admin3",
    name: "Board of Directors",
    email: "board@example.com",
    department: "Executive",
    polls: [],
  },
]

// Mock polls
const mockPolls: Poll[] = [
  {
    id: "poll1",
    title: "Annual Board Election",
    description: "Vote for the new board members for the upcoming year.",
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    createdBy: "admin1",
    creatorName: "Election Committee",
    votingMechanism: "multiple-choice",
    options: ["John Doe", "Jane Smith", "Robert Johnson", "Emily Davis"],
    visibility: "everyone",
    anonymous: true,
    showResults: false,
    status: "active",
    totalVotes: 145,
  },
  {
    id: "poll2",
    title: "Office Location Preference",
    description: "Help us decide on the new office location.",
    startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
    createdBy: "admin2",
    creatorName: "HR Department",
    votingMechanism: "multiple-choice",
    options: ["Downtown", "Suburb", "Business Park", "Remote Work"],
    visibility: "everyone",
    anonymous: false,
    showResults: true,
    status: "active",
    totalVotes: 89,
  },
  {
    id: "poll3",
    title: "New Benefits Package Approval",
    description: "Rate the proposed benefits package for the next fiscal year.",
    startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
    endDate: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000).toISOString(), // 17 days from now
    createdBy: "admin2",
    creatorName: "HR Department",
    votingMechanism: "rating",
    ratingScale: {
      min: 1,
      max: 10,
    },
    visibility: "specific-groups",
    allowedGroups: ["employees", "managers"],
    anonymous: true,
    showResults: false,
    status: "upcoming",
    totalVotes: 0,
  },
  {
    id: "poll4",
    title: "Budget Approval",
    description: "Vote to approve the proposed budget for the next fiscal year.",
    startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
    endDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    createdBy: "admin3",
    creatorName: "Board of Directors",
    votingMechanism: "yes-no",
    visibility: "admin-only",
    anonymous: false,
    showResults: true,
    status: "ended",
    totalVotes: 12,
  },
  {
    id: "poll5",
    title: "Company Picnic Date",
    description: "Help us choose the best date for the company picnic.",
    startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
    createdBy: "admin2",
    creatorName: "HR Department",
    votingMechanism: "multiple-choice",
    options: ["June 15", "June 22", "July 6", "July 13"],
    visibility: "everyone",
    anonymous: false,
    showResults: true,
    status: "active",
    totalVotes: 203,
  },
  {
    id: "poll6",
    title: "Strategic Direction",
    description: "Vote on the strategic direction for the next 5 years.",
    startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(), // 21 days from now
    createdBy: "admin3",
    creatorName: "Board of Directors",
    votingMechanism: "multiple-choice",
    options: ["Expand Globally", "Focus on Local Markets", "Diversify Products", "Specialize Core Offerings"],
    visibility: "specific-groups",
    allowedGroups: ["executives", "managers"],
    anonymous: true,
    showResults: false,
    status: "upcoming",
    totalVotes: 0,
  },
]

// Update poll statuses based on current date
function updatePollStatuses() {
  const now = new Date()

  mockPolls.forEach((poll) => {
    const startDate = new Date(poll.startDate)
    const endDate = new Date(poll.endDate)

    if (now < startDate) {
      poll.status = "upcoming"
    } else if (now > endDate) {
      poll.status = "ended"
    } else {
      poll.status = "active"
    }
  })
}

// Call this function to ensure poll statuses are up-to-date
updatePollStatuses()

// Assign polls to admin accounts
mockPolls.forEach((poll) => {
  const adminAccount = adminAccounts.find((admin) => admin.id === poll.createdBy)
  if (adminAccount) {
    adminAccount.polls.push(poll)
  }
})

// Get all polls that a user can access
export function getAccessiblePolls(user: User): AdminAccount[] {
  // Update poll statuses before returning
  updatePollStatuses()

  // Deep clone to avoid modifying the original data
  const accessibleAdmins = JSON.parse(JSON.stringify(adminAccounts)) as AdminAccount[]

  // Filter polls for each admin based on user access
  return accessibleAdmins
    .map((admin) => {
      const isAdmin = user.role === "admin"

      // Filter polls based on visibility and user role
      const accessiblePolls = isAdmin
        ? admin.polls
        : admin.polls.filter((poll) => {
            if (poll.visibility === "everyone") return true
            if (poll.visibility === "specific-groups" && poll.allowedGroups?.includes("employees")) return true
            return false
          })

      return {
        ...admin,
        polls: accessiblePolls,
      }
    })
    .filter((admin) => admin.polls.length > 0) // Only include admins with accessible polls
}

// Get a specific poll by ID
export function getPollById(pollId: string): Poll | undefined {
  // Update poll statuses before returning
  updatePollStatuses()

  return mockPolls.find((poll) => poll.id === pollId)
}

// Check if a poll is currently active for voting
export function isPollActive(poll: Poll): boolean {
  const now = new Date()
  const startDate = new Date(poll.startDate)
  const endDate = new Date(poll.endDate)

  return now >= startDate && now <= endDate
}

// Get time remaining for an active poll (in seconds)
export function getTimeRemaining(poll: Poll): number | null {
  if (poll.status !== "active") return null

  const now = new Date()
  const endDate = new Date(poll.endDate)

  return Math.floor((endDate.getTime() - now.getTime()) / 1000)
}

// Get time until poll starts (in seconds)
export function getTimeUntilStart(poll: Poll): number | null {
  if (poll.status !== "upcoming") return null

  const now = new Date()
  const startDate = new Date(poll.startDate)

  return Math.floor((startDate.getTime() - now.getTime()) / 1000)
}

// Submit a vote for a poll
export async function submitVote(pollId: string, vote: any): Promise<{ success: boolean; message: string }> {
  const poll = mockPolls.find((p) => p.id === pollId)

  if (!poll) {
    return { success: false, message: "Poll not found" }
  }

  if (!isPollActive(poll)) {
    return {
      success: false,
      message: poll.status === "upcoming" ? "This poll is not yet active" : "This poll has ended",
    }
  }

  // In a real implementation, you would save the vote to a database
  // For now, just increment the vote count
  poll.totalVotes++

  return { success: true, message: "Vote submitted successfully" }
}
