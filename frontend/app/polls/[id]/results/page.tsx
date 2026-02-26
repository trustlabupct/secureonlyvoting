import { requireAuth } from "@/lib/auth"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CalendarIcon, ChevronLeft, AlertCircle, ShieldAlert, Ban, EyeOff, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { RealTimeResultsViewer } from "@/components/voting/real-time-results-viewer"
import { fetchApi } from "@/lib/api-client.server"
import { Button } from "@/components/ui/button"

// Define PollWithPermissions type (same as in PollPage)
type PollOption = { id: string; name: string; description?: string };
type RatingScale = { min: number; max: number; step?: number; labels?: { min?: string; max?: string; mid?: string; } };
type PollVisibility = "everyone" | "admin-only" | "specific-groups";
type ShowResultsTo = "voters" | "admins" | "everyone-after-close";
type PollWithPermissions = {
  id: string;
  name: string;
  description: string | null;
  startTime: string; 
  endTime: string; 
  votingMechanism: string;
  ratingScale: RatingScale | null;
  allowComments: boolean;
  visibility: PollVisibility;
  allowedGroups: string[] | null;
  showResultsTo: ShowResultsTo[];
  options: PollOption[];
  createdAt: string; 
  updatedAt: string; 
  hasVoted: boolean; 
  canView: boolean; 
  canVote: boolean; 
  showResultsRealtime: boolean; 
  showResultsAfterClose: boolean;
};

export default async function PollResultsPage({ 
  params 
}: { 
  params: Promise<{ id: string }> // Update param type to Promise
}) {
  const user = await requireAuth()
  // Await params before destructuring
  const { id } = await params;

  // Fetch poll data from backend
  let poll: PollWithPermissions | null = null;
  let fetchError: string | null = null;
  let isForbidden = false;
  try {
    poll = await fetchApi<PollWithPermissions>(`/polls/${id}`);
    // Explicitly check canView flag from response
    if (poll && !poll.canView) {
      isForbidden = true; 
    }
  } catch (error) {
    console.error(`Failed to fetch poll ${id} for results:`, error);
    if (error instanceof Error) {
        fetchError = error.message;
        if (fetchError.includes('404')) notFound();
        if (fetchError.includes('403')) isForbidden = true;
    } else {
        fetchError = "Failed to load poll details for results.";
    }
  }

  // If fetch failed or returned null
  if (!poll && !fetchError && !isForbidden) {
    notFound(); 
  }
  
  // Render Forbidden state (if user couldn't even view the poll)
  if (isForbidden) {
      return (
        <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
            <div className="max-w-md text-center">
                 <ShieldAlert className="mx-auto h-12 w-12 text-red-500 mb-4" />
                <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
                <p className="text-muted-foreground mb-6">You do not have permission to view this poll or its results.</p>
                <Button asChild>
                     <Link href="/dashboard">Back to Dashboard</Link>
                </Button>
            </div>
        </div>
    );
  }

  // Render error state if fetch failed for other reasons
  if (fetchError && !poll) {
      // ... (render generic fetch error message) ...
       return (
         <div className="min-h-screen bg-gray-50 p-6">
            {/* ... similar error rendering as before ... */}
         </div>
        );
  }

  // Should not happen, but safeguard
  if (!poll) {
     notFound(); 
  }

  // Calculate status and results availability based on fetched poll flags
  const getStatus = (startTime: string, endTime: string): "upcoming" | "active" | "ended" => {
    const now = new Date()
    const start = new Date(startTime)
    const end = new Date(endTime)
    if (now < start) return "upcoming"
    if (now > end) return "ended"
    return "active"
  }
  const status = getStatus(poll.startTime, poll.endTime);
  const now = new Date();
  const canSeeResultsNow = poll.showResultsRealtime || (poll.showResultsAfterClose && now >= new Date(poll.endTime));

  // Format dates
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href={`/polls/${id}`} className="text-purple-600 hover:text-purple-800 flex items-center">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Poll
          </Link>
        </div>

        {/* Poll Header Card (using poll data) */} 
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">Results: {poll.name}</CardTitle>
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
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>

        {/* Conditionally render results viewer or unavailable message */} 
        {canSeeResultsNow ? (
          <RealTimeResultsViewer pollId={id} /> // Assuming this component fetches its own detailed results
        ) : (
          <Card className="border-l-4 border-orange-400">
            <CardHeader>
              <CardTitle className="flex items-center"><EyeOff className="h-5 w-5 mr-2 text-orange-600"/> Results Not Available</CardTitle>
            </CardHeader>
            <CardContent>
                 <p className="text-muted-foreground">
                   {status === "upcoming" && "Results are not available until the poll starts and voting occurs."}
                   {status === "active" && "Results are not available until the poll ends, or until you vote (if permitted)."}
                   {status === "ended" && "You do not have permission to view the results for this poll."}
                   {!["upcoming", "active", "ended"].includes(status) && "Results cannot be displayed at this time due to the poll status or your permissions."}
                 </p>
                 <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Permission Denied or Timing Issue</AlertTitle>
                    <AlertDescription>
                      Poll settings restrict viewing results at this time.
                    </AlertDescription>
                 </Alert>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
