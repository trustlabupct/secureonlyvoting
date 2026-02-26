'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, RefreshCw, AlertTriangle, CheckCircle, ShieldOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { mfaService } from '@/lib/mfa-service';
import { RecoveryCodes } from './recovery-codes';

interface ManageMfaSectionProps {
  onMfaDisabled: () => void;
}

export function ManageMfaSection({ onMfaDisabled }: ManageMfaSectionProps) {
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [disableToken, setDisableToken] = useState('');
  const [regenerateToken, setRegenerateToken] = useState('');
  const { toast } = useToast();

  const handleRegenerate = async () => {
    if (!regenerateToken || regenerateToken.length !== 6) {
      setError('Please enter a valid 6-digit authentication code');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const data = await mfaService.regenerateRecoveryCodes({ token: regenerateToken });
      setNewCodes(data.recoveryCodes);
      setShowRegenerateDialog(false);
      setRegenerateToken('');
      toast({
        title: "Recovery codes regenerated",
        description: "Your old recovery codes have been invalidated.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate recovery codes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!disableToken || disableToken.length !== 6) {
      setError('Please enter a valid 6-digit authentication code');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await mfaService.disableMfa({ token: disableToken });
      setShowDisableDialog(false);
      setDisableToken('');
      onMfaDisabled();
      toast({
        title: "MFA disabled",
        description: "Two-factor authentication has been disabled for your account.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable MFA');
      setIsLoading(false);
    }
  };

  // Show new recovery codes if they were just regenerated
  if (newCodes.length > 0) {
    return <RecoveryCodes codes={newCodes} onAcknowledge={() => setNewCodes([])} isRegeneration />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-500" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Manage your two-factor authentication settings and recovery codes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status */}
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Two-factor authentication is enabled.</strong> Your account is protected with an additional layer of security.
            </AlertDescription>
          </Alert>

          {/* Recovery Codes Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Recovery Codes</h3>
              <p className="text-sm text-gray-600 mt-1">
                Recovery codes can be used to access your account if you lose your authenticator device.
              </p>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> We don't show existing recovery codes for security. 
                Generate new ones to view codes (this will invalidate current codes).
              </AlertDescription>
            </Alert>

            <Dialog open={showRegenerateDialog} onOpenChange={(open) => {
              setShowRegenerateDialog(open);
              if (!open) {
                setRegenerateToken('');
                setError('');
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Regenerate Recovery Codes
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Regenerate Recovery Codes</DialogTitle>
                  <DialogDescription>
                    Enter the current 6-digit code from your authenticator app to generate new recovery codes.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="regenerate-token">Authentication Code</Label>
                    <Input
                      id="regenerate-token"
                      type="text"
                      value={regenerateToken}
                      onChange={(e) => setRegenerateToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      className="text-center text-lg font-mono tracking-wider"
                      maxLength={6}
                      autoComplete="one-time-code"
                    />
                  </div>
                  {error && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        {error}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowRegenerateDialog(false)}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleRegenerate} 
                    disabled={isLoading || regenerateToken.length !== 6}
                  >
                    {isLoading ? 'Generating...' : 'Regenerate Codes'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Disable MFA Section */}
          <div className="space-y-4 pt-6 border-t">
            <div>
              <h3 className="text-lg font-medium text-red-700">Disable Two-Factor Authentication</h3>
              <p className="text-sm text-gray-600 mt-1">
                Disabling two-factor authentication will make your account less secure.
              </p>
            </div>

            <Dialog open={showDisableDialog} onOpenChange={(open) => {
              setShowDisableDialog(open);
              if (!open) {
                setDisableToken('');
                setError('');
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="flex items-center gap-2">
                  <ShieldOff className="w-4 h-4" />
                  Disable MFA
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
                  <DialogDescription>
                    Enter the current 6-digit code from your authenticator app to disable MFA.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="disable-token">Authentication Code</Label>
                    <Input
                      id="disable-token"
                      type="text"
                      value={disableToken}
                      onChange={(e) => setDisableToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      className="text-center text-lg font-mono tracking-wider"
                      maxLength={6}
                      autoComplete="one-time-code"
                    />
                  </div>
                  {error && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        {error}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowDisableDialog(false)}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleDisable} 
                    disabled={isLoading || disableToken.length !== 6}
                  >
                    {isLoading ? 'Disabling...' : 'Disable MFA'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 