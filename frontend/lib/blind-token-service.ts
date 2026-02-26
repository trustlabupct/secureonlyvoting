/**
 * Blind Token Service for Anonymous Voting
 * 
 * Handles the cryptographic protocol for generating blind tokens
 * that preserve voter privacy in anonymous polls.
 */

interface BlindTokenResponse {
  blindTokenId: string;
  blindedSignature: string;
  publicKey: string;
}

interface PublicKeyResponse {
  publicKey: string;
}

interface ActiveTokenResponse {
  id: string;
  used: boolean;
  expiresAt: string;
  createdAt: string;
}

class BlindTokenService {
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

  /**
   * Get the server's public key for blind signature verification
   */
  async getPublicKey(): Promise<string> {
    try {
      const response = await fetch(`${this.getApiUrl()}/blind-tokens/public-key`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get public key: ${response.status} ${response.statusText}`);
      }

      const data: { data: PublicKeyResponse } = await response.json();
      return data.data.publicKey;
    } catch (error) {
      console.error('Error getting public key:', error);
      throw new Error('Failed to retrieve public key for blind signing');
    }
  }

  /**
   * Generate a new blind token for anonymous voting
   */
  async generateBlindToken(authToken: string): Promise<BlindTokenResponse> {
    try {
      const response = await fetch(`${this.getApiUrl()}/blind-tokens/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to generate blind token: ${response.status} ${response.statusText}`);
      }

      const data: { data: BlindTokenResponse } = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error generating blind token:', error);
      throw new Error('Failed to generate blind token');
    }
  }

  /**
   * Get user's active (unused) blind tokens
   */
  async getActiveTokens(authToken: string): Promise<ActiveTokenResponse[]> {
    try {
      const response = await fetch(`${this.getApiUrl()}/blind-tokens/my-tokens`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get active tokens: ${response.status} ${response.statusText}`);
      }

      const data: { data: ActiveTokenResponse[] } = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error getting active tokens:', error);
      throw new Error('Failed to retrieve active tokens');
    }
  }

  /**
   * Get or create a blind token for voting
   * First checks for existing unused tokens, then generates new one if needed
   */
  async getOrCreateBlindToken(authToken: string): Promise<string> {
    try {
      // First, try to get existing active tokens
      const activeTokens = await this.getActiveTokens(authToken);
      
      // Use the first unused token if available
      const unusedToken = activeTokens.find(token => !token.used);
      if (unusedToken) {
        console.log('Using existing blind token:', unusedToken.id);
        return unusedToken.id;
      }

      // If no unused tokens, generate a new one
      console.log('No unused tokens found, generating new blind token...');
      const newToken = await this.generateBlindToken(authToken);
      console.log('Generated new blind token:', newToken.blindTokenId);
      return newToken.blindTokenId;
    } catch (error) {
      console.error('Error getting or creating blind token:', error);
      throw error;
    }
  }

  /**
   * Validate that a blind token exists and is usable
   */
  async validateBlindToken(blindTokenId: string, authToken: string): Promise<boolean> {
    try {
      const activeTokens = await this.getActiveTokens(authToken);
      const token = activeTokens.find(t => t.id === blindTokenId);
      return token ? !token.used : false;
    } catch (error) {
      console.error('Error validating blind token:', error);
      return false;
    }
  }

  /**
   * Check if a poll requires anonymous voting (and thus blind tokens)
   */
  isAnonymousPoll(poll: any): boolean {
    return poll && poll.anonymous === true;
  }
}

// Export singleton instance
export const blindTokenService = new BlindTokenService();

// Export types for use in other files
export type { BlindTokenResponse, PublicKeyResponse, ActiveTokenResponse }; 