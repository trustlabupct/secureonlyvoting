"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, EyeOff, Eye } from "lucide-react"
import type { Poll } from "@/lib/types"
import { submitVoteClient } from "@/lib/vote-client"

interface SubmitVoteFormProps {
  poll: Poll
  userId: string
}

export function SubmitVoteForm({ poll, userId }: SubmitVoteFormProps) {
  const [selectedOption, setSelectedOption] = useState<string | number | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setResult(null)

    try {
      // Create voteData object based on voting mechanism
      const voteData: any = {}
      
      if (poll.votingMechanism === "yes-no") {
        // For yes-no polls, we need to find the option that matches the selected value
        // Since poll.options is string[] in this interface, we'll use the index or direct value
        voteData.optionId = selectedOption // This should work if backend accepts option names
      } else if (poll.votingMechanism === "multiple-choice") {
        voteData.optionId = selectedOption
      } else if (poll.votingMechanism === "rating") {
        voteData.ratingValue = rating
      }

      // Submit the vote - pass the poll object for anonymous voting support
      const result = await submitVoteClient(poll.id, voteData, poll)
      setResult(result)
    } catch (error) {
      setResult({
        success: false,
        message: "An error occurred while submitting your vote. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Check if the current time is within the voting period
  const now = new Date()
  const startDate = new Date(poll.startDate)
  const endDate = new Date(poll.endDate)
  const isVotingPeriod = now >= startDate && now <= endDate

  if (!isVotingPeriod) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {now < startDate
            ? `Voting has not started yet. Voting begins on ${startDate.toLocaleString()}.`
            : `Voting has ended. The poll closed on ${endDate.toLocaleString()}.`}
        </AlertDescription>
      </Alert>
    )
  }

  if (result) {
    return (
      <Alert variant={result.success ? "default" : "destructive"}> {/* Use "default" for success variant */}
        {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
        <AlertDescription>{result.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Anonymity notice */}
      <Alert variant="default" className={poll.anonymous ? "bg-green-50" : "bg-yellow-50"}>
        {poll.anonymous ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        <AlertTitle>{poll.anonymous ? "Anonymous Voting" : "Identified Voting"}</AlertTitle>
        <AlertDescription>
          {poll.anonymous
            ? "Your vote will be anonymous. Your identity will not be stored or displayed with your vote."
            : "Your identity will be stored with your vote and may be visible in the results."}
        </AlertDescription>
      </Alert>

      {poll.votingMechanism === "yes-no" && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Cast Your Vote</h3>
          <RadioGroup value={selectedOption as string} onValueChange={setSelectedOption}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="yes" />
              <Label htmlFor="yes">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="no" />
              <Label htmlFor="no">No</Label>
            </div>
          </RadioGroup>
        </div>
      )}

      {poll.votingMechanism === "multiple-choice" && poll.options && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Cast Your Vote</h3>
          <RadioGroup value={selectedOption as string} onValueChange={setSelectedOption}>
            {poll.options.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`option-${index}`} />
                <Label htmlFor={`option-${index}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      )}

      {poll.votingMechanism === "rating" && poll.ratingScale && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            Rate from {poll.ratingScale.min} to {poll.ratingScale.max}
          </h3>
          <div className="flex flex-wrap gap-2">
            {Array.from(
              { length: poll.ratingScale.max - poll.ratingScale.min + 1 },
              (_, i) => i + poll.ratingScale!.min,
            ).map((ratingValue) => (
              <Button
                key={ratingValue}
                type="button"
                variant={rating === ratingValue ? "default" : "outline"}
                className="h-10 w-10 rounded-full"
                onClick={() => setRating(ratingValue)}
              >
                {ratingValue}
              </Button>
            ))}
          </div>
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={
          isSubmitting ||
          (poll.votingMechanism === "yes-no" && !selectedOption) ||
          (poll.votingMechanism === "multiple-choice" && !selectedOption) ||
          (poll.votingMechanism === "rating" && !rating)
        }
      >
        {isSubmitting ? "Submitting..." : "Submit Vote"}
      </Button>
    </form>
  )
}
