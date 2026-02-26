import type { AdminAccount, Election, Poll } from "@/lib/types"
import { PollCard } from "./poll-card"

interface AdminPollsSectionProps {
  adminAccount: AdminAccount
}

function toElection(poll: Poll): Election {
  return {
    id: poll.id,
    name: poll.title,
    description: poll.description,
    startTime: poll.startDate,
    endTime: poll.endDate,
    votingMechanism: poll.votingMechanism,
    createdAt: poll.startDate,
    updatedAt: poll.endDate,
    options: (poll.options ?? []).map((option, index) => ({
      id: `${poll.id}-option-${index}`,
      name: option,
      description: null,
    })),
    ratingScale: poll.ratingScale ?? null,
    allowComments: poll.allowComments,
    anonymous: poll.anonymous,
    showResults: poll.showResults,
  }
}

export function AdminPollsSection({ adminAccount }: AdminPollsSectionProps) {
  // Group polls by status
  const activePolls = adminAccount.polls.filter((poll) => poll.status === "active").map(toElection)
  const upcomingPolls = adminAccount.polls.filter((poll) => poll.status === "upcoming").map(toElection)
  const endedPolls = adminAccount.polls.filter((poll) => poll.status === "ended").map(toElection)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{adminAccount.name}</h2>
        <span className="text-sm text-gray-500">{adminAccount.department}</span>
      </div>

      {activePolls.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-md font-medium text-green-700">Active Polls</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activePolls.map((election) => (
              <PollCard key={election.id} election={election} />
            ))}
          </div>
        </div>
      )}

      {upcomingPolls.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-md font-medium text-blue-700">Upcoming Polls</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingPolls.map((election) => (
              <PollCard key={election.id} election={election} />
            ))}
          </div>
        </div>
      )}

      {endedPolls.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-md font-medium text-gray-700">Ended Polls</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {endedPolls.map((election) => (
              <PollCard key={election.id} election={election} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
