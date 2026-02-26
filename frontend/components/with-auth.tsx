'use client';

import { useEffect, useState, ComponentType } from 'react';
import { useRouter } from 'next/navigation';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user?: any;
}

/**
 * Higher-order component that protects pages from unauthenticated access
 */
export function withAuth<P extends object>(
  WrappedComponent: ComponentType<P>
): ComponentType<P> {
  const AuthenticatedComponent = (props: P) => {
    const [authState, setAuthState] = useState<AuthState>({
      isAuthenticated: false,
      isLoading: true,
    });
    const router = useRouter();

    useEffect(() => {
      const checkAuthentication = async () => {
        try {
          // Since we use HTTP-only cookies, we don't need to manually handle tokens
          // The browser will automatically include cookies in requests
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };

          const response = await fetch('/api/auth/profile', {
            method: 'GET',
            headers,
            credentials: 'include', // Include HTTP-only cookies for authentication
          });

          if (response.ok) {
            const user = await response.json();
            setAuthState({
              isAuthenticated: true,
              isLoading: false,
              user,
            });
          } else if (response.status === 401) {
            // User is not authenticated
            router.push('/login');
            return; // Don't update state as we're redirecting
          } else {
            // Other error
            console.error('Authentication check failed:', response.status);
            router.push('/login');
            return;
          }
        } catch (error) {
          console.error('Authentication check error:', error);
          router.push('/login');
          return;
        }
      };

      checkAuthentication();
    }, [router]);

    // Show loading state while checking authentication
    if (authState.isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
        </div>
      );
    }

    // If authenticated, render the wrapped component
    if (authState.isAuthenticated) {
      return <WrappedComponent {...props} />;
    }

    // This should not be reached due to redirects, but just in case
    return null;
  };

  // Set display name for debugging
  AuthenticatedComponent.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name})`;

  return AuthenticatedComponent;
} 