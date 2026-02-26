"use server"

import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { fetchApi } from "./api-client.server"

interface Poll {
  id: string
  title: string
  description: string
  anonymous: boolean
  options: Array<{ id: string; text: string }>
}

interface VoteRequest {
  pollId: string
  optionId: string
  blindTokenId?: string
}

// VotePayload interface for complex voting data
export interface VotePayload {
  optionId?: string;
  selectedOptionIds?: string[];
  ratingValue?: number;
  rankedOptionIds?: string[];
  textResponse?: string;
  comment?: string;
}

export async function submitVoteAction(formData: FormData, poll?: Poll) {
  const pollId = formData.get("pollId") as string
  const optionId = formData.get("optionId") as string

  if (!pollId || !optionId) {
    redirect(`/polls/${pollId}?error=missing_data`)
    return
  }

  try {
    // Get poll data if not provided
    let pollData = poll
    if (!pollData) {
      try {
        pollData = await fetchApi<Poll>(`/polls/${pollId}`)
      } catch (error) {
        console.error("Failed to fetch poll data:", error)
        redirect(`/polls/${pollId}?error=poll_not_found`)
        return
      }
    }

    // Check if anonymous voting is required
    if (pollData.anonymous) {
      console.log("Anonymous voting detected, getting blind token...")
      
      try {
        // Get or create a blind token via API (handles authentication server-side)
        const blindTokenResponse = await fetchApi<{ data: { id: string } }>('/blind-tokens', {
          method: 'POST'
        })
        
        const blindTokenId = blindTokenResponse.data.id
        console.log("Using blind token for anonymous vote:", blindTokenId)

        // Submit vote with blind token
        const voteRequest: VoteRequest = {
          pollId,
          optionId,
          blindTokenId
        }

        await fetchApi('/votes', {
          method: 'POST',
          body: JSON.stringify(voteRequest),
        })

        console.log("Anonymous vote submitted successfully with blind token:", blindTokenId)
      } catch (error) {
        console.error("Anonymous voting failed:", error)
        redirect(`/polls/${pollId}?error=anonymous_vote_failed`)
        return
      }
    } else {
      // Regular (non-anonymous) voting
      const voteRequest: VoteRequest = {
        pollId,
        optionId
      }

      await fetchApi('/votes', {
        method: 'POST',
        body: JSON.stringify(voteRequest),
      })

      console.log("Regular vote submitted successfully")
    }

    // Success redirect
    redirect(`/polls/${pollId}/results?success=vote_submitted`)
  } catch (error) {
    console.error("Vote submission failed:", error)
    redirect(`/polls/${pollId}?error=submission_failed`)
  }
}

// Legacy function for backward compatibility
export async function submitVote(pollId: string, optionId: string, poll?: Poll) {
  const formData = new FormData()
  formData.append("pollId", pollId)
  formData.append("optionId", optionId)
  
  return submitVoteAction(formData, poll)
}
