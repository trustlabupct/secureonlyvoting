"use server"

import { requireAuth } from "./auth"
import { revalidatePath } from "next/cache"
import { fetchApi } from "./api-client.server" // Import the server API client

// Re-define types from CreatePollForm or import if shared
enum PollVisibility {
  EVERYONE = "everyone",
  ADMIN_ONLY = "admin-only",
  SPECIFIC_GROUPS = "specific-groups",
}
type VotingMechanism = "yes-no" | "multiple-choice" | "multiple-selection" | "ranking" | "rating" | "text-response";
enum ShowResultsTo {
  VOTERS = "voters",
  ADMINS = "admins",
  EVERYONE_AFTER_CLOSE = "everyone-after-close",
}
type PollCreationPayload = {
  name: string;
  description: string;
  startTime: string; 
  endTime: string; 
  votingMechanism: VotingMechanism;
  options?: string[];
  ratingScale?: { min: number; max: number; step?: number; labels?: { min?: string; max?: string; mid?: string; } };
  visibility: PollVisibility;
  allowedGroups: string[] | undefined;
  showResultsTo?: ShowResultsTo[];
  anonymous?: boolean;
  allowComments?: boolean;
};

// Type for the actual poll entity returned by backend (simplified)
type CreatedPoll = {
  id: string;
  //... other fields if needed
}

// Type for updating polls
type PollUpdatePayload = Partial<PollCreationPayload>;

// Function to create a new poll by calling the backend API
export async function createPoll(
  pollData: PollCreationPayload, // Use the specific payload type from the form
): Promise<{ success: boolean; message: string; pollId?: string }> {
  const user = await requireAuth()

  // Ensure user is an admin
  if (user.role !== "admin") {
    return {
      success: false,
      message: "You do not have permission to create polls.",
    }
  }

  try {
    console.log("[Admin Action] Attempting to create poll:", pollData);

    // Prepare data for the backend, matching CreatePollDto structure
    const backendPayload = {
        name: pollData.name, 
        description: pollData.description,
        startTime: pollData.startTime, 
        endTime: pollData.endTime,    
        votingMechanism: pollData.votingMechanism,
        options: pollData.options ? pollData.options.map(optionName => ({ name: optionName })) : undefined,
        ratingScale: pollData.ratingScale, 
        visibility: pollData.visibility, 
        allowedGroups: pollData.allowedGroups, 
        showResultsTo: pollData.showResultsTo, 
        anonymous: pollData.anonymous, 
        allowComments: pollData.allowComments, 
    };

    // Clean up undefined properties (optional fields)
    Object.keys(backendPayload).forEach(key => {
      // Cast key to the specific keys of the object to satisfy TypeScript
      const typedKey = key as keyof typeof backendPayload;
      if (backendPayload[typedKey] === undefined) {
        delete backendPayload[typedKey];
      }
    });

    console.log("[Admin Action] Sending payload to backend:", backendPayload); // Log the final payload

    const response = await fetchApi<CreatedPoll>("/admin/polls", { // Expect CreatedPoll response
      method: 'POST',
      body: JSON.stringify(backendPayload), 
    });

    console.log("[Admin Action] Poll creation API response:", response);

    // Revalidate the dashboard path to show the new poll
    revalidatePath("/dashboard")
    // Optionally revalidate the admin polls list if one exists
    // revalidatePath("/admin/polls")

    return {
      success: true,
      message: "Poll created successfully!",
      pollId: response.id, 
    }
  } catch (error: any) {
    console.error("[Admin Action] Failed to create poll via API:", error);
    return {
      success: false,
      // Provide a more specific error message if possible
      message: `Failed to create poll: ${error.message || "Please try again."}`, 
    }
  }
}

// Function to update an existing poll
export async function updatePoll(
  pollId: string,
  pollData: PollUpdatePayload
): Promise<{ success: boolean; message: string }> {
  const user = await requireAuth()

  // Ensure user is an admin
  if (user.role !== "admin") {
    return {
      success: false,
      message: "You do not have permission to update polls.",
    }
  }

  try {
    console.log("[Admin Action] Attempting to update poll:", pollId, pollData);

    // Prepare data for the backend, matching UpdatePollDto structure
    const backendPayload = {
      name: pollData.name,
      description: pollData.description,
      startTime: pollData.startTime,
      endTime: pollData.endTime,
      votingMechanism: pollData.votingMechanism,
      options: pollData.options ? pollData.options.map(optionName => ({ name: optionName })) : undefined,
      ratingScale: pollData.ratingScale,
      visibility: pollData.visibility,
      allowedGroups: pollData.allowedGroups,
      showResultsTo: pollData.showResultsTo,
      anonymous: pollData.anonymous,
      allowComments: pollData.allowComments,
    };

    // Clean up undefined properties (optional fields)
    Object.keys(backendPayload).forEach(key => {
      const typedKey = key as keyof typeof backendPayload;
      if (backendPayload[typedKey] === undefined) {
        delete backendPayload[typedKey];
      }
    });

    console.log("[Admin Action] Sending update payload to backend:", backendPayload);

    const response = await fetchApi<CreatedPoll>(`/admin/polls/${pollId}`, {
      method: 'PATCH',
      body: JSON.stringify(backendPayload),
    });

    console.log("[Admin Action] Poll update API response:", response);

    // Revalidate the dashboard path to reflect the updated poll
    revalidatePath("/dashboard")
    revalidatePath(`/admin/polls/${pollId}`)

    return {
      success: true,
      message: "Poll updated successfully!",
    }
  } catch (error: any) {
    console.error("[Admin Action] Failed to update poll via API:", error);
    return {
      success: false,
      message: `Failed to update poll: ${error.message || "Please try again."}`,
    }
  }
}

// Function to delete an existing poll
export async function deletePoll(
  pollId: string
): Promise<{ success: boolean; message: string }> {
  const user = await requireAuth()

  // Ensure user is an admin
  if (user.role !== "admin") {
    return {
      success: false,
      message: "You do not have permission to delete polls.",
    }
  }

  try {
    console.log("[Admin Action] Attempting to delete poll:", pollId);

    await fetchApi(`/admin/polls/${pollId}`, {
      method: 'DELETE',
    });

    console.log("[Admin Action] Poll deletion successful");

    // Revalidate the dashboard path to remove the deleted poll
    revalidatePath("/dashboard")

    return {
      success: true,
      message: "Poll deleted successfully!",
    }
  } catch (error: any) {
    console.error("[Admin Action] Failed to delete poll via API:", error);
    return {
      success: false,
      message: `Failed to delete poll: ${error.message || "Please try again."}`,
    }
  }
}
