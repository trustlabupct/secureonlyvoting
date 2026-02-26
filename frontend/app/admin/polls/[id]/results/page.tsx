import { requireAuth } from "@/lib/auth"
import { getPollById } from "@/lib/poll-service"
import { notFound, redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { RealTimeResultsViewer } from "@/components/voting/real-time-results-viewer"
import { VotingActivityMonitor } from "@/components/admin/voting-activity-monitor"

export default async function AdminPollResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()

  // Only allow admins to access this page
  if (user.role !== "admin") {
    redirect("/dashboard")
  }

  const { id } = await params
  const poll = getPollById(id)

  if (!poll) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href={`/admin/polls/${id}`} className="text-purple-600 hover:text-purple-800 flex items-center">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Poll Management
          </Link>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl">Poll Results: {poll.title}</CardTitle>
            <CardDescription>Comprehensive results and voting activity for this poll</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="results">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="results">Results Dashboard</TabsTrigger>
                <TabsTrigger value="activity">Voting Activity</TabsTrigger>
              </TabsList>
              <TabsContent value="results" className="pt-6">
                <RealTimeResultsViewer pollId={id} refreshInterval={5000} />
              </TabsContent>
              <TabsContent value="activity" className="pt-6">
                <VotingActivityMonitor pollId={id} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
