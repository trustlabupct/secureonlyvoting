import { requireAuth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { CreatePollForm } from "@/components/admin/create-poll-form"

export default async function CreatePollPage() {
  const user = await requireAuth()

  // Only allow admins to access this page
  if (user.role !== "admin") {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard" className="text-purple-600 hover:text-purple-800 flex items-center">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Create New Poll</CardTitle>
            <CardDescription>Set up a new voting poll with your desired settings</CardDescription>
          </CardHeader>
          <CardContent>
            <CreatePollForm />
          </CardContent>
          <CardFooter className="text-sm text-gray-500">All fields marked with * are required</CardFooter>
        </Card>
      </div>
    </div>
  )
}
