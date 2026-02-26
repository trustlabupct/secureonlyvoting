'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Smartphone, Key, AlertTriangle, ArrowLeft } from 'lucide-react';
import { mfaService } from '@/lib/mfa-service';

interface LoginMfaModalProps {
  isOpen: boolean;
  intermediateToken: string;
  onSuccess: (token: string, user: any) => void;
  onCancel: () => void;
}

export function LoginMfaModal({ isOpen, intermediateToken, onSuccess, onCancel }: LoginMfaModalProps) {
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = useRecovery 
        ? await mfaService.verifyMfaRecovery({ recoveryCode: code }, intermediateToken)
        : await mfaService.verifyMfaLogin({ token: code }, intermediateToken);
      
      onSuccess(response.token || response.access_token, response.user);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Verification failed';
      setError(errorMessage);
      setRetryCount(prev => prev + 1);
      
      // Clear the code input for security
      setCode('');
      
      // Auto-clear error after 5 seconds
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRecoveryMode = () => {
    setUseRecovery(!useRecovery);
    setCode('');
    setError('');
  };

  const handleClose = () => {
    setCode('');
    setError('');
    setUseRecovery(false);
    setRetryCount(0);
    onCancel();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {useRecovery ? (
              <>
                <Key className="w-5 h-5 text-amber-500" />
                Recovery Code
              </>
            ) : (
              <>
                <Smartphone className="w-5 h-5 text-blue-500" />
                Two-Factor Authentication
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {useRecovery 
              ? 'Enter one of your recovery codes to complete sign in.'
              : 'Enter the 6-digit code from your authenticator app to complete sign in.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mfa-code">
              {useRecovery ? 'Recovery Code' : 'Authentication Code'}
            </Label>
            <Input
              id="mfa-code"
              type="text"
              value={code}
              onChange={(e) => {
                if (useRecovery) {
                  // Allow alphanumeric for recovery codes
                  setCode(e.target.value.toUpperCase());
                } else {
                  // Only digits for TOTP codes
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                }
              }}
              placeholder={useRecovery ? "ABC-123-XYZ" : "123456"}
              className={`text-center text-lg font-mono tracking-wider ${
                useRecovery ? '' : 'tracking-widest'
              }`}
              maxLength={useRecovery ? 20 : 6}
              autoComplete="one-time-code"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={toggleRecoveryMode}
              className="text-sm text-blue-600 hover:text-blue-800 p-0 h-auto"
            >
              {useRecovery ? (
                <>
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  Use authenticator app
                </>
              ) : (
                'Use a recovery code instead'
              )}
            </Button>
          </div>

          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !code.trim() || (!useRecovery && code.length !== 6)}
              className="flex-1"
            >
              {isLoading ? 'Verifying...' : 'Verify'}
            </Button>
          </div>
        </form>

        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
              {retryCount >= 3 && (
                <div className="mt-2 text-sm">
                  Having trouble? Try using a recovery code or contact support if you've lost access to your authenticator app.
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {!useRecovery && (
          <div className="text-xs text-gray-500 text-center">
            Codes refresh every 30 seconds. If the code doesn't work, wait for a new one.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 