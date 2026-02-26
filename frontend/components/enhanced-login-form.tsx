'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { LoginMfaModal } from '@/components/mfa/login-mfa-modal';

// Use relative paths for API calls (Next.js will proxy them)

interface LoginResponse {
  access_token?: string;
  token?: string;
  user?: any;
  requiresMFA?: boolean;
  tempToken?: string;
}

interface MfaState {
  isRequired: boolean;
  intermediateToken: string | null;
}

export function EnhancedLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mfaState, setMfaState] = useState<MfaState>({ 
    isRequired: false, 
    intermediateToken: null 
  });
  
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username: email, 
          password: password 
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid email or password');
        }
        throw new Error(`Login failed: ${response.status}`);
      }

      const data: LoginResponse = await response.json();

      if (data.requiresMFA) {
        // MFA is required - show MFA modal with the correct tempToken
        setMfaState({ 
          isRequired: true, 
          intermediateToken: data.tempToken || ''
        });
      } else {
        // Regular login successful - set cookie and redirect
        await handleLoginSuccess(data.access_token || data.token || '', data.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = async (token: string, user?: any) => {
    try {
      // Set the session cookie
      const cookieResponse = await fetch('/api/auth/set-cookie', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (!cookieResponse.ok) {
        throw new Error('Failed to set session cookie');
      }

      // Redirect to dashboard
      router.push('/dashboard');
      router.refresh(); // Refresh to ensure auth state is updated
    } catch (err) {
      setError('Login successful but failed to set session. Please try again.');
    }
  };

  const handleMfaSuccess = (token: string, user: any) => {
    handleLoginSuccess(token, user);
    setMfaState({ isRequired: false, intermediateToken: null });
  };

  const handleMfaCancel = () => {
    setMfaState({ isRequired: false, intermediateToken: null });
    setError('');
  };

  return (
    <>
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input 
            id="email" 
            name="email" 
            type="email" 
            placeholder="name@example.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
            autoComplete="email"
            disabled={isLoading}
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={isLoading}
          />
        </div>
        
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Signing in...' : 'Sign in with Email'}
        </Button>
      </form>

      {/* MFA Modal */}
      <LoginMfaModal
        isOpen={mfaState.isRequired}
        intermediateToken={mfaState.intermediateToken || ''}
        onSuccess={handleMfaSuccess}
        onCancel={handleMfaCancel}
      />
    </>
  );
} 