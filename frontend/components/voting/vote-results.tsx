import { getPollVotes } from "@/lib/vote-service"
import type { Poll, Vote } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { EyeOff, Eye, MessageSquare } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface VoteResultsProps {
  poll: Poll
  userRole: string
}

export function VoteResults({ poll, userRole }: VoteResultsProps) {
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
  } else if (poll.votingMechanism === "multiple-selection" && poll.options) {
    // For multiple selection, each option can be selected multiple times
    const counts = poll.options.map(
      (option) => votes.filter((vote) => Array.isArray(vote.value) && vote.value.includes(option)).length,
    )

    resultsData = {
      options: poll.options,
      counts,
      percentages: counts.map((count) => Math.round((count / votes.length) * 100)),
      // For multiple selection, percentages can add up to more than 100%
      totalSelections: counts.reduce((sum, count) => sum + count, 0),
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
  } else if (poll.votingMechanism === "ranking" && poll.options) {
    // For ranking, we need to calculate the average position for each option
    const positionSums: Record<string, number> = {}
    const positionCounts: Record<string, number> = {}

    poll.options.forEach((option) => {
      positionSums[option] = 0
      positionCounts[option] = 0
    })

    votes.forEach((vote) => {
      if (Array.isArray(vote.value)) {
        vote.value.forEach((option, index) => {
          positionSums[option] += index + 1
          positionCounts[option]++
        })
      }
    })

    // Calculate average positions
    const averagePositions: Record<string, number> = {}
    Object.keys(positionSums).forEach((option) => {
      averagePositions[option] = positionSums[option] / positionCounts[option]
    })

    // Sort options by average position (lowest first)
    const sortedOptions = [...poll.options].sort((a, b) => averagePositions[a] - averagePositions[b])

    resultsData = {
      sortedOptions,
      averagePositions,
      firstPlaceVotes: poll.options.map(
        (option) => votes.filter((vote) => Array.isArray(vote.value) && vote.value[0] === option).length,
      ),
    }
  } else if (poll.votingMechanism === "text-response") {
    // For text responses, just collect all responses
    resultsData = {
      responses: votes.map((vote) => ({
        text: vote.value,
        user: !poll.anonymous && vote.userName ? vote.userName : "Anonymous",
        timestamp: vote.timestamp,
      })),
    }
  }

  // Collect comments if they exist
  const comments = votes
    .filter((vote) => vote.comment && vote.comment.trim() !== "")
    .map((vote) => ({
      text: vote.comment,
      user: !poll.anonymous && vote.userName ? vote.userName : "Anonymous",
      timestamp: vote.timestamp,
    }))

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
        {/* Yes/No or Multiple Choice Results */}
        {(poll.votingMechanism === "yes-no" || poll.votingMechanism === "multiple-choice") && (
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
        )}

        {/* Multiple Selection Results */}
        {poll.votingMechanism === "multiple-selection" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Voters could select multiple options. Percentages show how many voters selected each option.
            </p>
            {resultsData.options.map((option: string, index: number) => (
              <div key={index} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{option}</span>
                  <span>
                    {resultsData.counts[index]} selections ({resultsData.percentages[index]}%)
                  </span>
                </div>
                <Progress value={resultsData.percentages[index]} className="h-2" />
              </div>
            ))}
            <p className="text-sm text-gray-500 pt-2">
              Total selections: {resultsData.totalSelections} across {votes.length} votes
            </p>
          </div>
        )}

        {/* Rating Results */}
        {poll.votingMechanism === "rating" && (
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

        {/* Ranking Results */}
        {poll.votingMechanism === "ranking" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-2">Options ranked by average position (lower is better)</p>
            {resultsData.sortedOptions.map((option: string, index: number) => (
              <div key={option} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">
                    {index + 1}. {option}
                  </span>
                  <span>Avg. position: {resultsData.averagePositions[option].toFixed(1)}</span>
                </div>
                <Progress
                  value={100 - ((resultsData.averagePositions[option] - 1) / (poll.options!.length - 1)) * 100}
                  className="h-2"
                />
              </div>
            ))}
          </div>
        )}

        {/* Text Response Results */}
        {poll.votingMechanism === "text-response" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-2">
              {resultsData.responses.length} text {resultsData.responses.length === 1 ? "response" : "responses"}{" "}
              received
            </p>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {resultsData.responses.map((response: any, index: number) => (
                <div key={index} className="p-3 bg-gray-50 rounded-md">
                  <div className="flex justify-between text-sm text-gray-500 mb-1">
                    <span>{response.user}</span>
                    <span>{new Date(response.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{response.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments Section */}
        {comments.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <Accordion type="single" collapsible>
              <AccordionItem value="comments">
                <AccordionTrigger className="flex items-center">
                  <div className="flex items-center">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    <span>
                      {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 max-h-60 overflow-y-auto pt-2">
                    {comments.map((comment, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-md">
                        <div className="flex justify-between text-sm text-gray-500 mb-1">
                          <span>{comment.user}</span>
                          <span>{new Date(comment.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="whitespace-pre-wrap">{comment.text}</p>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}

        {/* Show individual votes for non-anonymous polls if user is admin */}
        {!poll.anonymous && userRole === "admin" && (
          <div className="mt-6 border-t pt-4">
            <Accordion type="single" collapsible>
              <AccordionItem value="individual-votes">
                <AccordionTrigger>Individual Votes</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {votes.map((vote: Vote) => (
                      <div key={vote.id} className="text-sm p-2 bg-gray-50 rounded-md">
                        <div className="flex justify-between">
                          <span className="font-medium">{vote.userName || "Anonymous"}</span>
                          <span className="text-gray-500">{new Date(vote.timestamp).toLocaleString()}</span>
                        </div>
                        <div>
                          Vote:{" "}
                          <span className="font-medium">
                            {Array.isArray(vote.value)
                              ? vote.value.join(", ")
                              : typeof vote.value === "string" && vote.value.length > 50
                                ? `${vote.value.substring(0, 50)}...`
                                : vote.value}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
