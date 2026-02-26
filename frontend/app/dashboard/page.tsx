import { requireAuth } from "@/lib/auth" // Keep requireAuth from here
import { logout } from "@/app/actions/auth-actions" // Import logout from the correct actions file
// Removed: import { getAccessiblePolls } from "@/lib/poll-service"
import { fetchApi } from "@/lib/api-client.server" // Import the server API client
import { Election } from "@/lib/types" // Import the new Election type
import { Button } from "@/components/ui/button"
// Removed: import { AdminPollsSection } from "@/components/admin-polls-section" // This component expects AdminAccount structure
import { PollCard } from "@/components/poll-card" // Use PollCard instead for individual polls
import { LogOut, Plus, Vote, User } from "lucide-react"
import Link from "next/link"

export default async function DashboardPage() {
  const user = await requireAuth()
  // Fetch elections from the backend API
  let elections: Election[] = [];
  let fetchError: string | null = null;
  try {
    elections = await fetchApi<Election[]>('/polls');
  } catch (error) {
    console.error("Failed to fetch polls:", error);
    fetchError = error instanceof Error ? error.message : "Failed to load polls.";
    // Assign empty array on error to prevent render issues
    elections = [];
  }
  const totalPolls = elections.length; // Use the fetched elections count

  // Determine active polls based on fetched data
  const now = new Date();
  const activePollsCount = elections.filter(election => {
      const startTime = new Date(election.startTime);
      const endTime = new Date(election.endTime);
      return now >= startTime && now <= endTime;
  }).length;


  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Vote className="h-8 w-8 text-purple-600 mr-3" />
            <h1 className="text-2xl font-bold text-gray-900">Secure Voting Platform</h1>
          </div>
          <div className="flex items-center space-x-4">
            {/* My Account navigation link */}
            <Button asChild variant="ghost">
              <Link href="/account">
                <User className="mr-2 h-4 w-4" />
                My Account
              </Link>
            </Button>
            {user.role === "admin" && (
              <>
                <Button asChild variant="outline">
                  <Link href="/admin/dashboard">
                    <Vote className="mr-2 h-4 w-4" />
                    Admin Dashboard
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/admin/polls/create">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Poll
                  </Link>
                </Button>
              </>
            )}
            <form action={logout}>
              <Button type="submit" variant="ghost" size="icon">
                <LogOut className="h-5 w-5" />
                <span className="sr-only">Logout</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">Welcome, {user.name}!</h2>
              <p className="text-gray-600">
                You are logged in as a <span className="font-medium">{user.role}</span>
              </p>
            </div>
            <div className="bg-purple-100 text-purple-800 px-4 py-2 rounded-full text-sm font-medium">
              {/* Display active polls count */}
              {activePollsCount}{" "}
              Active Polls
            </div>
          </div>
        </div>

        {/* Display error message if fetch failed */}
        {fetchError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline"> {fetchError}</span>
          </div>
        )}

        {/* Display polls or no polls message */}
        {totalPolls === 0 && !fetchError ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">No Polls Available</h2>
            <p className="text-gray-600 mb-6">There are currently no polls available.</p>
            {user.role === "admin" && (
              <Button asChild>
                <Link href="/admin/polls/create">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Poll
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Map over the fetched elections and render PollCard for each */}
            {elections.map((election) => (
              // PollCard expects 'election' prop, pass it correctly
              <PollCard key={election.id} election={election} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
