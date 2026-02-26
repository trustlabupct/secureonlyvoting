"use client"

import { useEffect, useState } from "react"
import { getRealtimeVoteCount } from "@/lib/poll-actions"
import { CheckCircle, Users, AlertCircle, LogIn } from "lucide-react"
import React from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface RealTimeVoteCounterProps {
  pollId: string
  initialCount: number
  refreshInterval?: number // in milliseconds
}

export function RealTimeVoteCounter({
  pollId,
  initialCount,
  refreshInterval = 10000, // Default to 10 seconds
}: RealTimeVoteCounterProps) {
  const [voteCount, setVoteCount] = useState(initialCount)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const router = useRouter()

  // Function to fetch the latest vote count
  const fetchVoteCount = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const result = await getRealtimeVoteCount(pollId)
      if (result !== null) {
        setVoteCount(result.count)
        setSessionExpired(false) // Reset session expired state if successful
      } else {
        // If result is null (e.g. 401, 403, or other fetch error from poll-actions)
        // Stop polling or handle appropriately. For now, we just won't update.
        // And we should probably stop the interval.
        if (intervalIdRef.current) clearInterval(intervalIdRef.current);
        
        // Check if this might be a session expiration (401)
        // We can't directly check the error code here since poll-actions returns null
        // But we can infer it based on the context
        setSessionExpired(true)
        setError("Your session has expired. Please log in again to continue viewing real-time updates.");
      }
    } catch (err) {
      // This catch might not be strictly needed anymore if getRealtimeVoteCount handles its own errors and returns null
      // However, keeping it for safety for unexpected issues.
      setError("Failed to update vote count")
      console.error("Error fetching vote count in component:", err)
      if (intervalIdRef.current) clearInterval(intervalIdRef.current);
    } finally {
      setIsLoading(false)
    }
  }

  // Store intervalId in a ref to clear it from within fetchVoteCount
  const intervalIdRef = React.useRef<NodeJS.Timeout | null>(null);

  // Set up polling for real-time updates
  useEffect(() => {
    fetchVoteCount() // Fetch immediately on mount

    // Set up interval for polling
    intervalIdRef.current = setInterval(fetchVoteCount, refreshInterval)

    // Clean up interval on unmount
    return () => {
      if (intervalIdRef.current) clearInterval(intervalIdRef.current);
    }
  }, [pollId, refreshInterval])

  const handleLoginRedirect = () => {
    const currentPath = window.location.pathname
    router.push(`/login?callbackUrl=${encodeURIComponent(currentPath)}`)
  }

  return (
    <div className="flex items-center space-x-2">
      <div className="flex items-center">
        <Users className="h-4 w-4 mr-1 text-gray-500" />
        <span className="text-sm">
          {voteCount} {voteCount === 1 ? "vote" : "votes"} cast
          {isLoading && <span className="ml-1 text-gray-400">(updating...)</span>}
        </span>
      </div>

      {sessionExpired && (
        <div className="flex items-center space-x-2 text-sm">
          <div className="flex items-center text-amber-600">
            <AlertCircle className="h-4 w-4 mr-1" />
            <span>Session expired</span>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleLoginRedirect}
            className="flex items-center gap-1 h-6 px-2 text-xs"
          >
            <LogIn className="h-3 w-3" />
            Log in again
          </Button>
        </div>
      )}

      {error && !sessionExpired && <div className="text-sm text-red-500">{error}</div>}
    </div>
  )
}
