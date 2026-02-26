"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"

interface TimeDisplayProps {
  endDate: string
  startDate: string
  status: "upcoming" | "active" | "ended"
}

export function TimeDisplay({ endDate, startDate, status }: TimeDisplayProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("")

  useEffect(() => {
    // Function to calculate and format time remaining
    const updateTimeRemaining = () => {
      const now = new Date()
      const end = new Date(endDate)
      const start = new Date(startDate)

      let diff: number
      let prefix: string

      if (status === "active") {
        // For active polls, show time until end
        diff = end.getTime() - now.getTime()
        prefix = "Ends in: "
      } else if (status === "upcoming") {
        // For upcoming polls, show time until start
        diff = start.getTime() - now.getTime()
        prefix = "Starts in: "
      } else {
        // For ended polls, show when it ended
        const endedAgo = now.getTime() - end.getTime()
        const days = Math.floor(endedAgo / (1000 * 60 * 60 * 24))
        setTimeRemaining(`Ended ${days} ${days === 1 ? "day" : "days"} ago`)
        return
      }

      // Calculate time components
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

      // Format the time remaining
      if (days > 0) {
        setTimeRemaining(`${prefix}${days}d ${hours}h`)
      } else if (hours > 0) {
        setTimeRemaining(`${prefix}${hours}h ${minutes}m`)
      } else {
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)
        setTimeRemaining(`${prefix}${minutes}m ${seconds}s`)
      }
    }

    // Update immediately
    updateTimeRemaining()

    // Then update every second
    const interval = setInterval(updateTimeRemaining, 1000)

    // Clean up interval on unmount
    return () => clearInterval(interval)
  }, [endDate, startDate, status])

  return (
    <div className="flex items-center text-sm">
      <Clock className="mr-2 h-4 w-4 opacity-70" />
      <span
        className={status === "active" ? "text-green-700" : status === "upcoming" ? "text-blue-700" : "text-gray-500"}
      >
        {timeRemaining}
      </span>
    </div>
  )
}
