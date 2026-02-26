"use server"

import { fetchApi } from "./api-client.server"; // Import server fetchApi

// Define expected structure for poll results
export interface PollResult {
  optionId: string;
  optionName: string;
  count: number;
}

/**
 * Server Action to fetch detailed poll results from the backend.
 */
export async function getPollResults(pollId: string): Promise<PollResult[]> {
  try {
    const results = await fetchApi<PollResult[]>(`/polls/${pollId}/results`);
    return results;
  } catch (error) {
    console.error(`Error fetching results for poll ${pollId}:`, error);
    // Re-throw the error to be handled by the calling component
    throw error;
  }
}

/**
 * Server Action to fetch the real-time vote count for a poll from the backend.
 */
export async function getRealtimeVoteCount(pollId: string): Promise<{ count: number } | null> {
  try {
    const result = await fetchApi<{ count: number }>(`/polls/${pollId}/vote-count`);
    return result;
  } catch (err: any) {
    if (err.message && err.message.includes('401')) {
      console.warn(`Session expired while fetching vote count for poll ${pollId} (401) - user needs to log in again.`);
      return null; // Return null for 401 errors (session expired)
    }
    if (err.message && err.message.includes('403')) {
      console.warn(`No permission to view vote counts for poll ${pollId} (403) - hiding widget.`);
      return null; // Return null for 403 errors
    }
    console.error(`Error fetching vote count for poll ${pollId}:`, err);
    // For other errors, you might still want to return a default or re-throw
    // For now, let's return null for any fetch error to prevent breaking UI, 
    // or consider if { count: 0 } is better for non-403 errors.
    // Matching the suggestion to return null for 403s, and extending to other errors for safety:
    return null; 
  }
}