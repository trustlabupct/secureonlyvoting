"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { getPollResults } from "@/lib/poll-actions" // Keep import from poll-actions
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  EyeOff,
  Eye,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  BarChart3,
  List,
  SortAsc,
  SortDesc,
  Search,
} from "lucide-react"
import { RealTimeVoteCounter } from "./real-time-vote-counter"

interface RealTimeResultsViewerProps {
  pollId: string
  refreshInterval?: number // in milliseconds
}

export function RealTimeResultsViewer({ pollId, refreshInterval = 10000 }: RealTimeResultsViewerProps) {
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("summary")
  const [sortBy, setSortBy] = useState<string>("timestamp")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [searchTerm, setSearchTerm] = useState("")
  const [commentFilter, setCommentFilter] = useState<"all" | "with-comments" | "no-comments">("all")

  // Function to fetch the latest results
  const fetchResults = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await getPollResults(pollId)
      
      // Check if response is an array (expected format from getPollResults)
      if (Array.isArray(response)) {
        setResults({
          success: true,
          results: {
            summary: response,
            // Placeholder for individual votes if they become available
            individualVotes: []
          },
          poll: {
            id: pollId,
            totalVotes: response.reduce((sum, option) => sum + option.count, 0),
            status: 'ended', // Default status
            anonymous: true, // Default anonymous setting
          },
          canViewIndividualVotes: false // Default permission
        })
      } else {
        setError("Invalid results format received")
      }
    } catch (err: any) {
      if (err.message && err.message.includes("403")) {
        setError("You do not have permission to view these results at this time (403).");
      } else {
        setError("An error occurred while loading results. Please try refreshing.");
      }
      console.error("Error fetching poll results:", err);
    } finally {
      setLoading(false)
    }
  }

  // Set up polling for real-time updates
  useEffect(() => {
    fetchResults()

    const intervalId = setInterval(fetchResults, refreshInterval)

    return () => clearInterval(intervalId)
  }, [pollId, refreshInterval])

  if (loading && !results) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Results</CardTitle>
          <CardDescription>Please wait while we fetch the latest results...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Results Not Available</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!results || !results.results) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Results Available</CardTitle>
          <CardDescription>There are no results to display at this time.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { poll, results: pollResults, canViewIndividualVotes, userRole } = results

  // Filter and sort individual votes
  const filteredVotes = pollResults.individualVotes
    .filter((vote: any) => {
      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const matchesName = vote.userName?.toLowerCase().includes(searchLower)
        const matchesComment = vote.comment?.toLowerCase().includes(searchLower)
        const matchesValue =
          typeof vote.value === "string"
            ? vote.value.toLowerCase().includes(searchLower)
            : Array.isArray(vote.value)
              ? vote.value.some((v: string) => v.toLowerCase().includes(searchLower))
              : false

        if (!matchesName && !matchesComment && !matchesValue) {
          return false
        }
      }

      // Apply comment filter
      if (commentFilter === "with-comments" && !vote.comment) {
        return false
      }
      if (commentFilter === "no-comments" && vote.comment) {
        return false
      }

      return true
    })
    .sort((a: any, b: any) => {
      // Apply sorting
      if (sortBy === "timestamp") {
        return sortDirection === "asc"
          ? new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      }

      if (sortBy === "name") {
        const nameA = a.userName || "Anonymous"
        const nameB = b.userName || "Anonymous"
        return sortDirection === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
      }

      return 0
    })

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Poll Results</CardTitle>
            <CardDescription>
              {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"} cast
              {poll.status === "active" ? " so far" : ""}
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={fetchResults} className="flex items-center gap-1">
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <div className="flex items-center text-sm text-gray-500">
              {poll.anonymous ? (
                <>
                  <EyeOff className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Anonymous</span>
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Identified</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <RealTimeVoteCounter pollId={pollId} initialCount={poll.totalVotes} refreshInterval={refreshInterval} />

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="summary" className="flex items-center gap-1">
                <BarChart3 className="h-4 w-4" />
                Summary
              </TabsTrigger>
              <TabsTrigger
                value="individual"
                disabled={!canViewIndividualVotes || poll.anonymous}
                className="flex items-center gap-1"
              >
                <List className="h-4 w-4" />
                Individual Votes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="pt-4">
              {renderSummaryResults(pollResults.summary)}
            </TabsContent>

            <TabsContent value="individual" className="pt-4">
              {!canViewIndividualVotes || poll.anonymous ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Individual votes are not available for anonymous polls.</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search votes..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <Select value={commentFilter} onValueChange={(value: any) => setCommentFilter(value)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by comments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All votes</SelectItem>
                        <SelectItem value="with-comments">With comments</SelectItem>
                        <SelectItem value="no-comments">Without comments</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="timestamp">Time</SelectItem>
                          <SelectItem value="name">Name</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                      >
                        {sortDirection === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {filteredVotes.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No votes match your filters</div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {filteredVotes.map((vote: any) => (
                        <div key={vote.id} className="p-3 bg-gray-50 rounded-md">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{vote.userName}</span>
                            <span className="text-gray-500">{new Date(vote.timestamp).toLocaleString()}</span>
                          </div>
                          <div className="mt-1">
                            <span className="text-sm font-medium">Vote: </span>
                            <span>{formatVoteValue(vote.value, poll.votingMechanism, poll.options)}</span>
                          </div>
                          {vote.comment && (
                            <div className="mt-2 pt-2 border-t text-sm">
                              <div className="flex items-center text-gray-500 mb-1">
                                <MessageSquare className="h-3 w-3 mr-1" />
                                <span>Comment:</span>
                              </div>
                              <p className="whitespace-pre-wrap">{vote.comment}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  )
}

// Helper function to format vote values based on voting mechanism
function formatVoteValue(value: any, mechanism: string, options?: string[]): React.ReactNode {
  if (mechanism === "yes-no") {
    return value === "yes" ? "Yes" : "No"
  }

  if (mechanism === "multiple-choice") {
    return value
  }

  if (mechanism === "multiple-selection" && Array.isArray(value)) {
    return value.join(", ")
  }

  if (mechanism === "rating") {
    return `Rating: ${value}`
  }

  if (mechanism === "ranking" && Array.isArray(value) && options) {
    return (
      <ol className="list-decimal ml-5">
        {value.map((option, index) => (
          <li key={index}>{option}</li>
        ))}
      </ol>
    )
  }

  if (mechanism === "text-response") {
    return (
      <div className="whitespace-pre-wrap">
        {typeof value === "string" && value.length > 100 ? `${value.substring(0, 100)}...` : value}
      </div>
    )
  }

  return JSON.stringify(value)
}

// Helper function to render summary results based on voting mechanism
function renderSummaryResults(summary: any[]) {
  // If there are no votes yet
  if (!summary || summary.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>No votes have been cast yet.</AlertDescription>
      </Alert>
    )
  }

  // Calculate total votes for percentage
  const totalVotes = summary.reduce((sum, item) => sum + item.count, 0)

  return (
    <div className="space-y-4">
      {summary.map((item, index) => {
        const percentage = totalVotes > 0 ? (item.count / totalVotes) * 100 : 0
        
        return (
          <div key={index} className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="font-medium">{item.optionName}</div>
              <div className="text-sm text-gray-500">
                {item.count} {item.count === 1 ? "vote" : "votes"} ({percentage.toFixed(1)}%)
              </div>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>
        )
      })}
    </div>
  )
}
