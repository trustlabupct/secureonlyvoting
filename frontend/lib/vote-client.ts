"use client"

import { fetchApi } from "./api-client.client"
import type { VotePayload } from "./vote-actions"

interface Poll {
  id: string
  anonymous: boolean
}

interface VoteRequest {
  pollId: string
  optionId?: string
  selectedOptionIds?: string[]
  ratingValue?: number
  rankedOptionIds?: string[]
  textResponse?: string
  comment?: string
  blindTokenId?: string
}

export async function submitVoteClient(
  pollId: string,
  payload: VotePayload,
  poll?: Poll
): Promise<{ success: boolean; message: string; voteId?: string }> {
  try {
    // Check if anonymous voting is required
    if (poll?.anonymous) {
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
          ...payload,
          blindTokenId
        }

        const result = await fetchApi('/votes', {
          method: 'POST',
          body: JSON.stringify(voteRequest),
        })

        console.log("Anonymous vote submitted successfully with blind token:", blindTokenId)
        return { success: true, message: "Vote submitted successfully", voteId: result?.id }
      } catch (error) {
        console.error("Anonymous voting failed:", error)
        throw error
      }
    } else {
      // Regular (non-anonymous) voting
      const voteRequest: VoteRequest = {
        pollId,
        ...payload
      }

      const result = await fetchApi('/votes', {
        method: 'POST',
        body: JSON.stringify(voteRequest),
      })

      console.log("Regular vote submitted successfully")
      return { success: true, message: "Vote submitted successfully", voteId: result?.id }
    }
  } catch (error) {
    console.error("Vote submission failed:", error)
    const errorMessage = error instanceof Error ? error.message : "Vote submission failed"
    return { success: false, message: errorMessage }
  }
} 