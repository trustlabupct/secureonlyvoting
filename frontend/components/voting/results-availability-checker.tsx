"use client"

import { useState, useEffect } from "react"
// import { checkResultsAvailability } from "@/lib/poll-actions" // Import the new server action

// Mock function for checking results availability
const checkResultsAvailability = async (pollId: string) => {
  // Simple mock implementation
  return {
    available: true,
    showResults: true,
    status: "active",
    hasVoted: true
  }
}
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Eye, Lock } from "lucide-react"
import Link from "next/link"

interface ResultsAvailabilityCheckerProps {
  pollId: string
  refreshInterval?: number
}

export function ResultsAvailabilityChecker({ pollId, refreshInterval = 30000 }: ResultsAvailabilityCheckerProps) {
  const [availability, setAvailability] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const checkAvailability = async () => {
    try {
      setLoading(true)
      setError(null)

      const result = await checkResultsAvailability(pollId) // Call the new server action
      setAvailability(result)
    } catch (err) {
      setError("Failed to check results availability")
      console.error("Error checking results availability:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkAvailability()

    const intervalId = setInterval(checkAvailability, refreshInterval)

    return () => clearInterval(intervalId)
  }, [pollId, refreshInterval])

  if (loading && !availability) {
    return <div className="text-center py-2">Checking results availability...</div>
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!availability) {
    return null
  }

  if (availability.available) {
    return (
      <div className="flex justify-center mt-4">
        <Button asChild>
          <Link href={`/polls/${pollId}/results`} className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            View Results
          </Link>
        </Button>
      </div>
    )
  }

  // Results not available - show appropriate message
  let message = "Results are not available at this time."

  if (!availability.showResults) {
    message = "The administrator has disabled results viewing for this poll."
  } else if (availability.status === "upcoming") {
    message = "Results will be available after the poll starts."
  } else if (availability.status === "active" && !availability.hasVoted) {
    message = "You need to vote in this poll before you can see the results."
  } else if (availability.status === "active") {
    message = "Results will be available after the poll ends."
  }

  return (
    <Alert variant="default" className="mt-4">
      <Lock className="h-4 w-4" />
      <AlertTitle>Results Not Available</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
