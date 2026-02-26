import { getPollVotes } from "@/lib/vote-service"
import type { Poll } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { EyeOff, Eye } from "lucide-react"

interface PollResultsProps {
  poll: Poll
  userRole: string
}

export function PollResults({ poll, userRole }: PollResultsProps) {
  // Get votes for this poll
  const votes = getPollVotes(poll.id, userRole)

  // If no votes or results not visible, show message
  if (votes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Poll Results</CardTitle>
          <CardDescription>
            {poll.status !== "ended"
              ? "Results will be available after the poll ends."
              : "No votes were cast in this poll."}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // Process votes based on voting mechanism
  let resultsData: any = {}

  if (poll.votingMechanism === "yes-no") {
    const yesVotes = votes.filter((vote) => vote.value === "yes").length
    const noVotes = votes.filter((vote) => vote.value === "no").length

    resultsData = {
      options: ["Yes", "No"],
      counts: [yesVotes, noVotes],
      percentages: [Math.round((yesVotes / votes.length) * 100), Math.round((noVotes / votes.length) * 100)],
    }
  } else if (poll.votingMechanism === "multiple-choice" && poll.options) {
    const counts = poll.options.map((option) => votes.filter((vote) => vote.value === option).length)

    resultsData = {
      options: poll.options,
      counts,
      percentages: counts.map((count) => Math.round((count / votes.length) * 100)),
    }
  } else if (poll.votingMechanism === "rating" && poll.ratingScale) {
    // Calculate average rating
    const ratings = votes.map((vote) => Number(vote.value))
    const averageRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length

    // Count occurrences of each rating
    const ratingCounts: Record<number, number> = {}
    for (let i = poll.ratingScale.min; i <= poll.ratingScale.max; i++) {
      ratingCounts[i] = 0
    }

    ratings.forEach((rating) => {
      ratingCounts[rating]++
    })

    resultsData = {
      averageRating: averageRating.toFixed(1),
      ratingCounts,
      min: poll.ratingScale.min,
      max: poll.ratingScale.max,
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Poll Results</CardTitle>
          <div className="flex items-center text-sm text-gray-500">
            {poll.anonymous ? (
              <>
                <EyeOff className="h-4 w-4 mr-1" />
                <span>Anonymous</span>
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-1" />
                <span>Identified</span>
              </>
            )}
          </div>
        </div>
        <CardDescription>
          {votes.length} {votes.length === 1 ? "vote" : "votes"} cast
        </CardDescription>
      </CardHeader>
      <CardContent>
        {poll.votingMechanism === "yes-no" || poll.votingMechanism === "multiple-choice" ? (
          <div className="space-y-4">
            {resultsData.options.map((option: string, index: number) => (
              <div key={index} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{option}</span>
                  <span>
                    {resultsData.counts[index]} votes ({resultsData.percentages[index]}%)
                  </span>
                </div>
                <Progress value={resultsData.percentages[index]} className="h-2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <span className="text-3xl font-bold">{resultsData.averageRating}</span>
              <p className="text-sm text-gray-500">Average rating (out of {resultsData.max})</p>
            </div>
            <div className="space-y-2">
              {Object.entries(resultsData.ratingCounts).map(([rating, count]: [string, any]) => (
                <div key={rating} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Rating {rating}</span>
                    <span>
                      {count} {count === 1 ? "vote" : "votes"} ({Math.round((count / votes.length) * 100)}%)
                    </span>
                  </div>
                  <Progress value={Math.round((count / votes.length) * 100)} className="h-2" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Show individual votes for non-anonymous polls if user is admin */}
        {!poll.anonymous && userRole === "admin" && (
          <div className="mt-6 border-t pt-4">
            <h4 className="font-medium mb-2">Individual Votes</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {votes.map((vote) => (
                <div key={vote.id} className="text-sm p-2 bg-gray-50 rounded-md">
                  <div className="flex justify-between">
                    <span className="font-medium">{vote.userName || "Anonymous"}</span>
                    <span className="text-gray-500">{new Date(vote.timestamp).toLocaleString()}</span>
                  </div>
                  <div>
                    Vote: <span className="font-medium">{vote.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
