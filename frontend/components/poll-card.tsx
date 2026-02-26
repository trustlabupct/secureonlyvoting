"use client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { Election } from "@/lib/types" // Use Election type
import { CalendarIcon } from "lucide-react"
import Link from "next/link"
import { TimeDisplay } from "./time-display"

interface PollCardProps {
  election: Election // Changed prop name and type
}

export function PollCard({ election }: PollCardProps) { // Changed prop name
  // Format dates for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Calculate status based on dates
  const getStatus = (startTime: string, endTime: string): "upcoming" | "active" | "ended" => {
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (now < start) return "upcoming";
    if (now > end) return "ended";
    return "active";
  };

  const status = getStatus(election.startTime, election.endTime);

  // Determine status color
  const getStatusColor = (status: "upcoming" | "active" | "ended") => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "upcoming":
        return "bg-blue-100 text-blue-800";
      case "ended":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  // Removed: getVotingMechanismText function (data not available)

  // Calculate progress of the voting period
  const calculateProgress = () => {
    const now = new Date();
    const start = new Date(election.startTime); // Use election.startTime
    const end = new Date(election.endTime); // Use election.endTime

    // If election hasn't started yet
    if (now < start) return 0

    // If poll has ended
    if (now > end) return 100

    // Calculate progress percentage
    const totalDuration = end.getTime() - start.getTime()
    const elapsed = now.getTime() - start.getTime()
    return Math.round((elapsed / totalDuration) * 100)
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{election.name}</CardTitle> {/* Use election.name */}
          <Badge className={getStatusColor(status)}> {/* Use calculated status */}
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>
        <CardDescription>{election.description}</CardDescription> {/* Use election.description */}
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="space-y-3 text-sm">
          <div className="flex items-center">
            <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
            <span>
              {formatDate(election.startTime)} - {formatDate(election.endTime)} {/* Use election times */}
            </span>
          </div>

          {/* Time remaining display */}
          {/* Pass calculated status */}
          <TimeDisplay endDate={election.endTime} startDate={election.startTime} status={status} />

          {/* Progress bar for voting period */}
          <div className="space-y-1">
            <Progress value={calculateProgress()} className="h-2" />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Start</span>
              <span>End</span>
            </div>
          </div>

          {/* Removed Voting Mechanism, Anonymity, Visibility, Total Votes display (data not available) */}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          asChild
          className="w-full"
          variant={status === "active" ? "default" : "secondary"} /* Use calculated status */
          disabled={status !== "active" && status !== "ended"} /* Only disable for upcoming polls */
        >
          <Link href={status === "ended" ? `/polls/${election.id}/results` : `/polls/${election.id}`}> {/* Redirect to results for ended polls */}
            {/* Use calculated status */}
            {status === "active" ? "Vote Now" : status === "ended" ? "View Results" : "Coming Soon"}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
