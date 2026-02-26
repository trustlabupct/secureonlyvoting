export interface Poll {
  id: string
  title: string
  description: string
  startDate: string
  endDate: string
  createdBy: string // Admin ID
  creatorName: string // Admin name
  votingMechanism: "yes-no" | "multiple-choice" | "multiple-selection" | "rating" | "ranking" | "text-response"
  options?: string[] // For multiple choice/selection/ranking polls
  ratingScale?: {
    min: number
    max: number
    step?: number
    labels?: {
      min?: string
      max?: string
      mid?: string
    }
  } // For rating polls
  visibility: "admin-only" | "specific-groups" | "everyone"
  allowedGroups?: string[] // IDs of groups allowed to vote
  anonymous: boolean
  showResults: boolean
  status: "upcoming" | "active" | "ended"
  totalVotes: number
  allowComments?: boolean // Whether voters can add comments with their votes
}

export interface AdminAccount {
  id: string
  name: string
  email: string
  department: string
  polls: Poll[]
}

export interface Vote {
  id: string
  pollId: string
  value: any // The vote value (yes/no, option, rating, etc.)
  comment?: string // Optional comment from voter
  timestamp: string
  userId: string
  userName?: string // Only included for non-anonymous polls
  userEmail?: string // Only included for non-anonymous polls
}

// For ranking votes, we need to store the order
export interface RankingVote extends Vote {
  value: string[] // Array of option IDs in ranked order
}

// For multiple selection votes, we need to store multiple selections
export interface MultipleSelectionVote extends Vote {
  value: string[] // Array of selected option IDs
}

// For text response votes
export interface TextResponseVote extends Vote {
  value: string // Text response
}

// Type for poll options, aligning with backend entity
export interface Option {
  id: string;
  name: string;
  description: string | null;
}

export interface Election {
  id: string;
  name: string;
  description: string | null;
  startTime: string; // ISO Date string
  endTime: string; // ISO Date string
  votingMechanism: string; // Added field
  createdAt: string; // ISO Date string
  updatedAt: string; // ISO Date string
  options: Option[]; // Use the renamed Option type
  hasVoted?: boolean; // Add this field (optional for now as backend needs update)
  // Add fields from backend entity that are now expected
  ratingScale?: {
    min: number;
    max: number;
    step?: number;
    labels?: { min?: string; max?: string; mid?: string };
  } | null;
  allowComments?: boolean;
  anonymous?: boolean;      // Add anonymous field
  showResults?: boolean;    // Add showResults field
  canVote?: boolean;        // Add canVote field
}
