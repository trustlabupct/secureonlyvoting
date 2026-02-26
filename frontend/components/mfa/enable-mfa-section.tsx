'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, CheckCircle, Shield, Smartphone, Key, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { mfaService } from '@/lib/mfa-service';
import { RecoveryCodes } from './recovery-codes';

interface EnableMfaSectionProps {
  onMfaEnabled: () => void;
}

export function EnableMfaSection({ onMfaEnabled }: EnableMfaSectionProps) {
  const [setupData, setSetupData] = useState<{ setupKey: string; qrCodeUrl: string } | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasCopiedKey, setHasCopiedKey] = useState(false);
  const { toast } = useToast();

  // Generate QR code when setup data changes
  useEffect(() => {
    if (setupData?.qrCodeUrl) {
      setQrCodeDataUrl(setupData.qrCodeUrl);  // Use the URL directly from backend
    }
  }, [setupData]);

  const handleStartSetup = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await mfaService.setupMfa();
      setSetupData({
        setupKey: data.setupKey,
        qrCodeUrl: data.qrCodeUrl
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup MFA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSetup = () => {
    setSetupData(null);
    setQrCodeDataUrl('');
    setVerificationCode('');
    setError('');
    setHasCopiedKey(false);
    toast({
      title: "Setup cancelled",
      description: "MFA setup has been cancelled.",
    });
  };

  const handleVerifyAndEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const data = await mfaService.enableMfa({ token: verificationCode });
      setRecoveryCodes(data.recoveryCodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code');
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const copyKeyToClipboard = async () => {
    if (!setupData) return;
    try {
      await navigator.clipboard.writeText(setupData.setupKey);
      setHasCopiedKey(true);
      toast({
        title: "Copied to clipboard",
        description: "Setup key has been copied to your clipboard.",
      });
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Failed to copy setup key to clipboard.",
        variant: "destructive",
      });
    }
  };

  // Show recovery codes after successful setup
  if (recoveryCodes.length > 0) {
    return <RecoveryCodes codes={recoveryCodes} onAcknowledge={onMfaEnabled} />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-500" />
              <CardTitle>Set Up Two-Factor Authentication</CardTitle>
            </div>
            {setupData && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelSetup}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
                Cancel Setup
              </Button>
            )}
          </div>
          <CardDescription>
            Add an extra layer of security to your account by requiring a verification code from your phone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!setupData ? (
            <div className="space-y-4">
              <Alert>
                <Smartphone className="h-4 w-4" />
                <AlertDescription>
                  You'll need an authenticator app like Google Authenticator, Authy, or 1Password to continue.
                  Make sure you have one of these apps installed on your phone before proceeding.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-3">
                <h4 className="font-medium">Popular authenticator apps:</h4>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>Google Authenticator (Android, iOS)</li>
                  <li>Microsoft Authenticator (Android, iOS)</li>
                  <li>Authy (Android, iOS, Desktop)</li>
                  <li>1Password (Android, iOS, Desktop)</li>
                </ul>
              </div>

              <Button 
                onClick={handleStartSetup} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Generating setup code...' : 'Set up MFA'}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Step 1: Scan QR Code */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center font-medium">
                    1
                  </div>
                  <h3 className="text-lg font-medium">Scan QR Code</h3>
                </div>
                
                <p className="text-sm text-gray-600">
                  Open your authenticator app and scan the QR code below:
                </p>
                
                <div className="flex justify-center bg-white p-4 rounded-lg border">
                  {qrCodeDataUrl ? (
                    <img 
                      src={qrCodeDataUrl} 
                      alt="MFA Setup QR Code"
                      className="w-64 h-64"
                    />
                  ) : (
                    <div className="w-64 h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-gray-500">Generating QR code...</span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Can't scan the QR code? Enter this setup key manually:
                  </p>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
                    <code className="font-mono text-sm flex-1 break-all">
                      {setupData.setupKey}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyKeyToClipboard}
                      className="flex items-center gap-1"
                    >
                      {hasCopiedKey ? (
                        <>
                          <CheckCircle className="w-3 h-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Step 2: Verify Code */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center font-medium">
                    2
                  </div>
                  <h3 className="text-lg font-medium">Verify Setup</h3>
                </div>
                
                <p className="text-sm text-gray-600">
                  Enter the 6-digit verification code from your authenticator app:
                </p>
                
                <form onSubmit={handleVerifyAndEnable} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="verification-code">Verification Code</Label>
                    <Input
                      id="verification-code"
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      className="text-center text-lg font-mono tracking-wider"
                      maxLength={6}
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    disabled={isLoading || verificationCode.length !== 6}
                    className="w-full"
                  >
                    {isLoading ? 'Verifying...' : 'Verify & Enable MFA'}
                  </Button>
                </form>
              </div>
            </div>
          )}

          {error && (
            <Alert className="mt-4 border-red-200 bg-red-50">
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