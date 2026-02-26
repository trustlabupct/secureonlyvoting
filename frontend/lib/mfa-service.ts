export interface MfaSetupResponse {
  setupKey: string;
  qrCodeUrl: string;
  recoveryCodes?: string[];
}

export interface MfaEnableResponse {
  recoveryCodes: string[];
}

export interface MfaVerifyRequest {
  token: string;
}

export interface MfaRecoveryRequest {
  recoveryCode: string;
}

export interface LoginResponse {
  token: string;
  user: any;
  requiresMFA?: boolean;
}

export interface MfaLoginVerifyResponse {
  access_token: string;  // Backend returns access_token, not token
  refresh_token: string;
  expires_in: number;
  user: any;
  token?: string;  // Keep this for backwards compatibility
}

class MfaService {
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

  async setupMfa(): Promise<MfaSetupResponse> {
    const response = await fetch(`${this.getApiUrl()}/auth/mfa/setup`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      credentials: 'include', // Include HTTP-only cookies for authentication
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Redirect to login on authentication failure
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
          return Promise.reject(new Error('Redirecting to login...'));
        }
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Setup failed: ${response.status}`);
    }

    return response.json();
  }

  async enableMfa(request: MfaVerifyRequest): Promise<MfaEnableResponse> {
    const response = await fetch(`${this.getApiUrl()}/auth/mfa/enable`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      credentials: 'include', // Include HTTP-only cookies for authentication
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Redirect to login on authentication failure
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
          return Promise.reject(new Error('Redirecting to login...'));
        }
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Enable failed: ${response.status}`);
    }

    return response.json();
  }

  async verifyMfaLogin(request: MfaVerifyRequest, intermediateToken: string): Promise<MfaLoginVerifyResponse> {
    const response = await fetch(`${this.getApiUrl()}/auth/mfa/verify-login`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        tempToken: intermediateToken,
        token: request.token,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Invalid authentication code');
    }

    const data = await response.json();
    // Ensure backwards compatibility by setting token property
    if (data.access_token && !data.token) {
      data.token = data.access_token;
    }
    return data;
  }

  async verifyMfaRecovery(request: MfaRecoveryRequest, intermediateToken: string): Promise<MfaLoginVerifyResponse> {
    const response = await fetch(`${this.getApiUrl()}/auth/mfa/recovery-login`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        tempToken: intermediateToken,
        recoveryCode: request.recoveryCode,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Invalid recovery code');
    }

    const data = await response.json();
    // Ensure backwards compatibility by setting token property
    if (data.access_token && !data.token) {
      data.token = data.access_token;
    }
    return data;
  }

  async disableMfa(request: MfaVerifyRequest): Promise<void> {
    const response = await fetch(`${this.getApiUrl()}/auth/mfa`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
      credentials: 'include', // Include HTTP-only cookies for authentication
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Redirect to login on authentication failure
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
          return Promise.reject(new Error('Redirecting to login...'));
        }
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Disable failed: ${response.status}`);
    }
  }

  async regenerateRecoveryCodes(request: MfaVerifyRequest): Promise<MfaEnableResponse> {
    const response = await fetch(`${this.getApiUrl()}/auth/mfa/recovery-codes`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      credentials: 'include', // Include HTTP-only cookies for authentication
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Redirect to login on authentication failure
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
          return Promise.reject(new Error('Redirecting to login...'));
        }
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Regeneration failed: ${response.status}`);
    }

    return response.json();
  }

  async getUserProfile(): Promise<any> {
    const response = await fetch(`${this.getApiUrl()}/auth/profile`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
      credentials: 'include', // Include HTTP-only cookies for authentication
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Redirect to login on authentication failure
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
          return Promise.reject(new Error('Redirecting to login...'));
        }
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Profile fetch failed: ${response.status}`);
    }

    return response.json();
  }

  async verifyMFA(token: string): Promise<void> {
    // For password change flow, we just need to verify the TOTP token
    // This is a simplified verification that doesn't return tokens
    const response = await fetch(`${this.getApiUrl()}/auth/mfa/verify`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Invalid authentication code');
    }
  }

  async verifyRecoveryCode(recoveryCode: string): Promise<void> {
    // For password change flow, we just need to verify the recovery code
    // This is a simplified verification that doesn't return tokens
    const response = await fetch(`${this.getApiUrl()}/auth/mfa/verify-recovery`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ recoveryCode }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Invalid recovery code');
    }
  }
}

export const mfaService = new MfaService(); 