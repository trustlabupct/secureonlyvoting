'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Shield, Key, ArrowLeft, Eye, EyeOff, CheckCircle, AlertCircle, Home } from 'lucide-react';
import { mfaService } from '@/lib/mfa-service';
import { accountService } from '@/lib/account-service';
import { withAuth } from '@/components/with-auth';

interface UserProfile {
  id: string;
  username: string;
  name: string;
  role: string;
  mfaEnabled: boolean;
}

type Step = 'mfa' | 'current-password' | 'new-password' | 'success';

function PasswordChangePage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('mfa');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // MFA step state
  const [mfaCode, setMfaCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  
  // Password step state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      const profile = await accountService.getUserProfile();
      setUserProfile(profile);
      
      // If MFA is not enabled, skip to current password step
      if (!profile.mfaEnabled) {
        setCurrentStep('current-password');
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load user profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaVerification = async () => {
    try {
      setError('');
      setIsLoading(true);

      if (useRecoveryCode) {
        if (!recoveryCode.trim()) {
          setError('Please enter a recovery code');
          return;
        }
        await mfaService.verifyRecoveryCode(recoveryCode);
      } else {
        if (!mfaCode.trim() || mfaCode.length !== 6) {
          setError('Please enter a valid 6-digit code');
          return;
        }
        await mfaService.verifyMFA(mfaCode);
      }
      
      setCurrentStep('current-password');
    } catch (err) {
      console.error('MFA verification failed:', err);
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCurrentPasswordVerification = async () => {
    try {
      setError('');
      setIsLoading(true);

      if (!currentPassword.trim()) {
        setError('Please enter your current password');
        return;
      }

      await accountService.verifyCurrentPassword(currentPassword);
      setCurrentStep('new-password');
    } catch (err) {
      console.error('Current password verification failed:', err);
      setError(err instanceof Error ? err.message : 'Invalid current password');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    try {
      setError('');
      setIsLoading(true);

      // Validate new password
      if (!newPassword.trim()) {
        setError('Please enter a new password');
        return;
      }

      if (newPassword.length < 8) {
        setError('Password must be at least 8 characters long');
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      if (newPassword === currentPassword) {
        setError('New password must be different from current password');
        return;
      }

      await accountService.changePassword(currentPassword, newPassword);
      setCurrentStep('success');
      setSuccess('Password changed successfully!');
    } catch (err) {
      console.error('Password change failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const renderMfaStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Multi-Factor Authentication Required
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          To change your password, we need to verify your identity first.
        </p>
        
        {!useRecoveryCode ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="mfa-code">Authenticator Code</Label>
              <Input
                id="mfa-code"
                type="text"
                placeholder="Enter 6-digit code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="text-center text-lg tracking-widest"
              />
            </div>
            
            <Button onClick={() => setUseRecoveryCode(true)} variant="link" className="p-0">
              Use recovery code instead
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="recovery-code">Recovery Code</Label>
              <Input
                id="recovery-code"
                type="text"
                placeholder="Enter recovery code"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                className="font-mono"
              />
            </div>
            
            <Button onClick={() => setUseRecoveryCode(false)} variant="link" className="p-0">
              Use authenticator app instead
            </Button>
          </div>
        )}
        
        <Button onClick={handleMfaVerification} disabled={isLoading} className="w-full">
          {isLoading ? 'Verifying...' : 'Verify'}
        </Button>
      </CardContent>
    </Card>
  );

  const renderCurrentPasswordStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Verify Current Password
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Please enter your current password to continue.
        </p>
        
        <div>
          <Label htmlFor="current-password">Current Password</Label>
          <div className="relative">
            <Input
              id="current-password"
              type={showCurrentPassword ? "text" : "password"}
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            >
              {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        <Button onClick={handleCurrentPasswordVerification} disabled={isLoading} className="w-full">
          {isLoading ? 'Verifying...' : 'Continue'}
        </Button>
      </CardContent>
    </Card>
  );

  const renderNewPasswordStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Set New Password
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Choose a strong password that you haven't used before.
        </p>
        
        <div>
          <Label htmlFor="new-password">New Password</Label>
          <div className="relative">
            <Input
              id="new-password"
              type={showNewPassword ? "text" : "password"}
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setShowNewPassword(!showNewPassword)}
            >
              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        <div>
          <Label htmlFor="confirm-password">Confirm New Password</Label>
          <div className="relative">
            <Input
              id="confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Password requirements:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>At least 8 characters long</li>
            <li>Different from your current password</li>
          </ul>
        </div>
        
        <Button onClick={handlePasswordChange} disabled={isLoading} className="w-full">
          {isLoading ? 'Changing Password...' : 'Change Password'}
        </Button>
      </CardContent>
    </Card>
  );

  const renderSuccessStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          Password Changed Successfully
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Your password has been changed successfully. You can now use your new password to log in.
        </p>
        
        <div className="flex gap-3">
          <Button onClick={() => router.push('/account')} className="flex-1">
            Back to Account
          </Button>
          <Button onClick={() => router.push('/dashboard')} variant="outline" className="flex-1">
            Go to Dashboard
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading && !userProfile) {
    return (
      <div className="container mx-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-2xl mx-auto">
        {/* Navigation Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Key className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Change Password</h1>
              <nav className="flex text-sm text-muted-foreground mt-1">
                <span>Dashboard</span>
                <span className="mx-2">›</span>
                <span>Account</span>
                <span className="mx-2">›</span>
                <span>Security</span>
                <span className="mx-2">›</span>
                <span className="text-foreground">Password</span>
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
              <ArrowLeft className="h-4 w-4" />
              Back to Account
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

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Progress indicator */}
        {currentStep !== 'success' && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span className={currentStep === 'mfa' && userProfile?.mfaEnabled ? 'text-primary font-medium' : ''}>
                {userProfile?.mfaEnabled ? '1. MFA Verification' : ''}
              </span>
              <span className={currentStep === 'current-password' ? 'text-primary font-medium' : ''}>
                {userProfile?.mfaEnabled ? '2.' : '1.'} Current Password
              </span>
              <span className={currentStep === 'new-password' ? 'text-primary font-medium' : ''}>
                {userProfile?.mfaEnabled ? '3.' : '2.'} New Password
              </span>
            </div>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300" 
                style={{
                  width: currentStep === 'mfa' ? '33%' : 
                         currentStep === 'current-password' ? (userProfile?.mfaEnabled ? '66%' : '50%') : 
                         currentStep === 'new-password' ? '100%' : '0%'
                }}
              ></div>
            </div>
          </div>
        )}

        {/* Step content */}
        {currentStep === 'mfa' && userProfile?.mfaEnabled && renderMfaStep()}
        {currentStep === 'current-password' && renderCurrentPasswordStep()}
        {currentStep === 'new-password' && renderNewPasswordStep()}
        {currentStep === 'success' && renderSuccessStep()}
      </div>
    </div>
  );
}

export default withAuth(PasswordChangePage); 