interface UserProfile {
  id: string;
  username: string;  // Backend returns username (which contains the email)
  name: string;
  role: string;
  mfaEnabled: boolean;
  createdAt: string;
}

interface VotedPoll {
  id: string;
  title: string;
  votedAt: string;
  status: 'active' | 'closed' | 'draft';
}

class AccountService {
  private getApiUrl() {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      // Client-side: use relative paths (Next.js proxy will handle)
      return '/api';
    } else {
      // Server-side: use absolute URL
      return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    }
  }

  private getAuthHeaders(): Record<string, string> {
    // Since we use HTTP-only cookies, we don't need to manually handle tokens
    // The browser will automatically include cookies in requests
    return {
      'Content-Type': 'application/json',
    };
  }

  async getUserProfile(): Promise<UserProfile> {
    const response = await fetch(`${this.getApiUrl()}/auth/profile`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
      credentials: 'include', // Include HTTP-only cookies for authentication
    });

    if (!response.ok) {
      let errorMessage = `Profile fetch failed: ${response.status}`;
      
      if (response.status === 401) {
        // Redirect to login on authentication failure
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
          return Promise.reject(new Error('Redirecting to login...'));
        }
        errorMessage = 'Authentication required. Please log in.';
      } else if (response.status === 429) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else {
        const errorData = await response.json().catch(() => ({}));
        errorMessage = errorData.message || errorMessage;
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  }

  async getVotingHistory(): Promise<VotedPoll[]> {
    const response = await fetch(`${this.getApiUrl()}/votes/history`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
      credentials: 'include', // Include HTTP-only cookies for authentication
    });

    if (!response.ok) {
      // For now, return mock data if the endpoint doesn't exist
      if (response.status === 404) {
        return [
          {
            id: '1',
            title: 'Q1 Budget Allocation',
            votedAt: '2024-01-15T10:30:00Z',
            status: 'closed'
          },
          {
            id: '2', 
            title: 'Office Lunch Preferences',
            votedAt: '2024-01-10T14:20:00Z',
            status: 'active'
          }
        ];
      }
      
      let errorMessage = `Voting history fetch failed: ${response.status}`;
      
      if (response.status === 401) {
        // Redirect to login on authentication failure
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
          return Promise.reject(new Error('Redirecting to login...'));
        }
        errorMessage = 'Authentication required. Please log in.';
      } else if (response.status === 429) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else {
        const errorData = await response.json().catch(() => ({}));
        errorMessage = errorData.message || errorMessage;
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  }

  async verifyCurrentPassword(currentPassword: string): Promise<void> {
    const response = await fetch(`${this.getApiUrl()}/auth/verify-password`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ currentPassword }),
    });

    if (!response.ok) {
      let errorMessage = `Password verification failed: ${response.status}`;
      
      if (response.status === 401) {
        errorMessage = 'Invalid current password';
      } else if (response.status === 429) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else {
        const errorData = await response.json().catch(() => ({}));
        errorMessage = errorData.message || errorMessage;
      }
      
      throw new Error(errorMessage);
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const response = await fetch(`${this.getApiUrl()}/auth/change-password`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!response.ok) {
      let errorMessage = `Password change failed: ${response.status}`;
      
      if (response.status === 401) {
        errorMessage = 'Invalid current password';
      } else if (response.status === 400) {
        const errorData = await response.json().catch(() => ({}));
        errorMessage = errorData.message || 'Invalid password requirements';
      } else if (response.status === 429) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else {
        const errorData = await response.json().catch(() => ({}));
        errorMessage = errorData.message || errorMessage;
      }
      
      throw new Error(errorMessage);
    }
  }
}

export const accountService = new AccountService(); 