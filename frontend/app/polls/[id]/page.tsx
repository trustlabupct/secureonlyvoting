import { requireAuth } from "@/lib/auth"
// Removed: import { getPollById } from "@/lib/poll-service"
// Removed: import { hasUserVoted } from "@/lib/vote-service" // No longer needed, status comes from API
import { fetchApi } from "@/lib/api-client.server" // Import server API client
// Removed Election type: import { Election } from "@/lib/types" 
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CalendarIcon, ChevronLeft, EyeOff, Users, AlertTriangle, CheckCircle2, Timer, ShieldAlert, Ban } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button" // Import Button component
import { TimeDisplay } from "@/components/time-display"
import { Progress } from "@/components/ui/progress"
import { VoteForm } from "@/components/voting/vote-form"
// Removed: import { ResultsAvailabilityChecker } from "@/components/voting/results-availability-checker" // Commented out
import { RealTimeVoteCounter } from "@/components/voting/real-time-vote-counter"

// Define Poll type matching backend PollWithPermissions
// Assuming PollOption and RatingScale types are defined elsewhere or simple enough
type PollOption = { id: string; name: string; description?: string };
type RatingScale = { min: number; max: number; step?: number; labels?: { min?: string; max?: string; mid?: string; } };
type PollVisibility = "everyone" | "admin-only" | "specific-groups";
type ShowResultsTo = "voters" | "admins" | "everyone-after-close";

type PollWithPermissions = {
  id: string;
  name: string;
  description: string | null;
  startTime: string; // ISO Date string
  endTime: string; // ISO Date string
  votingMechanism: string;
  ratingScale: RatingScale | null;
  allowComments: boolean;
  visibility: PollVisibility;
  allowedGroups: string[] | null;
  showResultsTo: ShowResultsTo[];
  options: PollOption[];
  createdAt: string; // ISO Date string
  updatedAt: string; // ISO Date string
  // Permission Flags
  hasVoted: boolean; 
  canView: boolean; 
  canVote: boolean; 
  showResultsRealtime: boolean; 
  showResultsAfterClose: boolean;
  anonymous: boolean; // Added to match VoteForm's PollWithPermissions type
};

export default async function PollPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireAuth()

  // Fetch poll data from backend
  let poll: PollWithPermissions | null = null;
  let fetchError: string | null = null;
  let isForbidden = false;
  try {
    // Use the updated type for fetchApi
    poll = await fetchApi<PollWithPermissions>(`/polls/${id}`);
    // Explicitly check canView flag from response, although API should 403
    if (poll && !poll.canView) {
      isForbidden = true; 
    }
  } catch (error) {
    console.error(`Failed to fetch poll ${id}:`, error);
    if (error instanceof Error) {
        fetchError = error.message;
        if (fetchError.includes('404')) notFound();
        if (fetchError.includes('403')) isForbidden = true;
    } else {
        fetchError = "Failed to load poll details.";
    }
  }

  // If fetch failed (and wasn't 404/403 handled above) or returned null
  if (!poll && !fetchError && !isForbidden) {
    notFound(); 
  }
  
  // Render Forbidden state
  if (isForbidden) {
      return (
        <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
            <div className="max-w-md text-center">
                 <ShieldAlert className="mx-auto h-12 w-12 text-red-500 mb-4" />
                <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
                <p className="text-muted-foreground mb-6">You do not have permission to view this poll.</p>
                <Button asChild>
                     <Link href="/dashboard">Back to Dashboard</Link>
                </Button>
            </div>
        </div>
    );
  }

  // Render error state if fetch failed for other reasons
  if (fetchError && !poll) {
    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto">
                 <div className="mb-6">
                    <Link href="/dashboard" className="text-purple-600 hover:text-purple-800 flex items-center">
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Back to Dashboard
                    </Link>
                </div>
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error Loading Poll</AlertTitle>
                    <AlertDescription>{fetchError}</AlertDescription>
                </Alert>
            </div>
        </div>
    );
  }

  // Safeguard
  if (!poll) {
     notFound(); 
  }

  // Calculate status, format dates, calculate progress (using 'poll' variable)
  const getStatus = (startTime: string, endTime: string): "upcoming" | "active" | "ended" => {
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (now < start) return "upcoming";
    if (now > end) return "ended";
    return "active";
  };
  const status = getStatus(poll.startTime, poll.endTime);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "numeric", minute: "numeric",
    })
  }

  const calculateProgress = () => {
    const now = new Date()
    const start = new Date(poll.startTime) 
    const end = new Date(poll.endTime) 
    if (now < start) return 0
    if (now > end) return 100
    const totalDuration = end.getTime() - start.getTime()
    const elapsed = now.getTime() - start.getTime()
    return Math.round((elapsed / totalDuration) * 100)
  }

  const now = new Date();
  const canSeeResultsNow = poll.showResultsRealtime || (poll.showResultsAfterClose && now >= new Date(poll.endTime));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard" className="text-purple-600 hover:text-purple-800 flex items-center">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
        </div>

        {/* Poll Details Card (using 'poll' variable) */} 
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">{poll.name}</CardTitle>
                <CardDescription className="mt-2">{poll.description}</CardDescription>
              </div>
              <Badge
                className={
                  status === "active" 
                    ? "bg-green-100 text-green-800"
                    : status === "upcoming"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-800"
                }
              >
                {status.charAt(0).toUpperCase() + status.slice(1)} 
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-md space-y-4">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                <div className="flex items-center">
                  <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                  <span className="text-sm">
                    <strong>Start:</strong> {formatDate(poll.startTime)} 
                  </span>
                </div>
                <div className="flex items-center">
                  <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                  <span className="text-sm">
                    <strong>End:</strong> {formatDate(poll.endTime)} 
                  </span>
                </div>
              </div>

              {/* Time remaining display */}
              <div className="flex items-center justify-center">
                <TimeDisplay endDate={poll.endTime} startDate={poll.startTime} status={status} /> 
              </div>

              {/* Voting Progress Bar */}
              {status !== "upcoming" && (
                <div className="space-y-1">
                  <Progress value={calculateProgress()} className="h-2" />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{formatDate(poll.startTime).split(",")[0]}</span> 
                    <span>{formatDate(poll.endTime).split(",")[0]}</span> 
                  </div>
                </div>
              )}
            </div>
            
            {/* Status Alerts */}
            {status === "upcoming" && (
                <Alert variant="default">
                  <Timer className="h-4 w-4" />
                  <AlertTitle>This poll is not yet active</AlertTitle>
                  <AlertDescription>
                    Voting will begin on {formatDate(poll.startTime)}. Please check back then. 
                  </AlertDescription>
                </Alert>
            )}
            {status === "ended" && (
                <Alert variant="default">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>This poll has ended</AlertTitle>
                  <AlertDescription>
                    Voting closed on {formatDate(poll.endTime)}. 
                    {canSeeResultsNow ? " Results are available." : " Results may be available later."}
                  </AlertDescription>
                </Alert>
            )}
          </CardContent>
          <CardFooter className="flex justify-between items-center bg-gray-50 p-4 rounded-b-md">
             {poll.showResultsRealtime ? (
                <RealTimeVoteCounter pollId={poll.id} initialCount={0} /> 
             ) : (
                <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 mr-1 text-gray-500" />
                    <span className="text-sm text-gray-500">Real-time votes unavailable</span>
                </div>
             )}
             {canSeeResultsNow ? (
                <Button asChild variant="outline">
                    <Link href={`/polls/${poll.id}/results`}>View Results</Link>
                </Button>
             ) : (
                <Button variant="outline" disabled title="Results are not available yet or you lack permission.">
                    <EyeOff className="mr-2 h-4 w-4"/> View Results
                </Button>
            )}
          </CardFooter>
        </Card>

        {/* Voting Section - Unified Logic */}
        {status === "active" && poll.canVote && !poll.hasVoted ? (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Cast Your Vote</CardTitle>
              <CardDescription>Select your preferred option(s) below.</CardDescription>
            </CardHeader>
            <CardContent>
              <VoteForm poll={poll} userId={user.id} />
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-6 border-l-4 border-yellow-400">
             <CardHeader>
                <CardTitle className="flex items-center"><Ban className="h-5 w-5 mr-2 text-yellow-600"/> Voting Not Available</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">
                    {(() => {
                        if (status === "upcoming") return `This poll is not active yet. Voting will begin on ${formatDate(poll.startTime)}.`;
                        if (status === "ended") return `This poll has ended. Voting closed on ${formatDate(poll.endTime)}.`;
                        if (status === "active") {
                            if (poll.hasVoted) return "You have already submitted your vote for this poll.";
                            if (!poll.canVote) return "You do not have permission to vote in this poll at this time.";
                            // This case should ideally not be reached if the main condition for showing form is `status === "active" && poll.canVote && !poll.hasVoted`
                            // but acts as a fallback if logic somehow bypasses the form display for an active, votable, unvoted poll.
                            return "Voting is currently unavailable for an unexpected reason while the poll is active.";
                        }
                        return "Voting is not available at this time for an undetermined reason."; // Generic fallback
                    })()}
                </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
