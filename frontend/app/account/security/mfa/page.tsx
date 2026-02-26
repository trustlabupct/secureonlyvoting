'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { mfaService } from '@/lib/mfa-service';
import { EnableMfaSection } from '@/components/mfa/enable-mfa-section';
import { ManageMfaSection } from '@/components/mfa/manage-mfa-section';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Shield, AlertCircle, Home, User } from 'lucide-react';
import { withAuth } from '@/components/with-auth';

interface MfaStatus {
  isLoading: boolean;
  isEnabled: boolean | null;
  error: string | null;
}

function MfaSettingsPage() {
  const [mfaStatus, setMfaStatus] = useState<MfaStatus>({
    isLoading: true,
    isEnabled: null,
    error: null,
  });
  const router = useRouter();

  // Fetch the user's MFA status on component mount
  useEffect(() => {
    loadMfaStatus();
  }, []);

  const loadMfaStatus = async () => {
    try {
      setMfaStatus(prev => ({ ...prev, isLoading: true, error: null }));
      const profile = await mfaService.getUserProfile();
      setMfaStatus({ 
        isLoading: false, 
        isEnabled: profile.mfaEnabled || false, 
        error: null 
      });
    } catch (err) {
      setMfaStatus({ 
        isLoading: false, 
        isEnabled: null, 
        error: err instanceof Error ? err.message : 'Failed to load MFA status' 
      });
    }
  };

  // Callback to update the UI after MFA is enabled or disabled
  const handleMfaUpdate = (newStatus: boolean) => {
    setMfaStatus({ 
      isLoading: false, 
      isEnabled: newStatus, 
      error: null 
    });
  };

  if (mfaStatus.isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8" />
                <div>
                  <Skeleton className="h-8 w-64" />
                  <Skeleton className="h-4 w-48 mt-1" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
              </div>
            </div>
            
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-6 w-48" />
                </div>
                <Skeleton className="h-4 w-96" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-10 w-32" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (mfaStatus.error) {
    return (
      <div className="container mx-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-6">
            {/* Navigation Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-3xl font-bold">Security Settings</h1>
                  <nav className="flex text-sm text-muted-foreground mt-1">
                    <span>Dashboard</span>
                    <span className="mx-2">›</span>
                    <span>Account</span>
                    <span className="mx-2">›</span>
                    <span>Security</span>
                    <span className="mx-2">›</span>
                    <span className="text-foreground">MFA</span>
                  </nav>
                </div>
              </div>
              
              {/* Navigation Buttons */}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => router.push('/account')}
                  className="flex items-center gap-2"
                >
                  <User className="h-4 w-4" />
                  Account
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/dashboard')}
                  className="flex items-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  Dashboard
                </Button>
              </div>
            </div>
            
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Error loading security settings:</strong> {mfaStatus.error}
                <div className="mt-2">
                  <button 
                    onClick={loadMfaStatus}
                    className="text-red-600 hover:text-red-800 underline text-sm"
                  >
                    Try again
                  </button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="space-y-6">
          {/* Navigation Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold">Security Settings</h1>
                <nav className="flex text-sm text-muted-foreground mt-1">
                  <span>Dashboard</span>
                  <span className="mx-2">›</span>
                  <span>Account</span>
                  <span className="mx-2">›</span>
                  <span>Security</span>
                  <span className="mx-2">›</span>
                  <span className="text-foreground">MFA</span>
                </nav>
              </div>
            </div>
            
            {/* Navigation Buttons */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => router.push('/account')}
                className="flex items-center gap-2"
              >
                <User className="h-4 w-4" />
                Account
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Dashboard
              </Button>
            </div>
          </div>

          {/* Main content */}
          <div className="space-y-6">
            {mfaStatus.isEnabled ? (
              <ManageMfaSection onMfaDisabled={() => handleMfaUpdate(false)} />
            ) : (
              <EnableMfaSection onMfaEnabled={() => handleMfaUpdate(true)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default withAuth(MfaSettingsPage); 