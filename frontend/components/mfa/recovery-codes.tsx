'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RecoveryCodesProps {
  codes: string[];
  onAcknowledge: () => void;
  isRegeneration?: boolean;
}

export function RecoveryCodes({ codes, onAcknowledge, isRegeneration = false }: RecoveryCodesProps) {
  const [hasCopied, setHasCopied] = useState(false);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const { toast } = useToast();

  const copyToClipboard = async () => {
    try {
      const codesText = codes.join('\n');
      await navigator.clipboard.writeText(codesText);
      setHasCopied(true);
      toast({
        title: "Copied to clipboard",
        description: "Recovery codes have been copied to your clipboard.",
      });
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Failed to copy codes to clipboard. Please copy them manually.",
        variant: "destructive",
      });
    }
  };

  const handleAcknowledge = () => {
    setHasAcknowledged(true);
    setTimeout(() => {
      onAcknowledge();
    }, 500);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            {isRegeneration ? 'New Recovery Codes Generated' : 'Your Recovery Codes'}
          </CardTitle>
          <CardDescription>
            {isRegeneration 
              ? 'Your old recovery codes have been invalidated. Save these new codes in a secure location.'
              : 'Save these codes in a secure location. Each code can only be used once.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> These codes will only be shown once. If you lose access to your authenticator app, 
              you'll need these codes to regain access to your account.
            </AlertDescription>
          </Alert>

          <div className="bg-gray-50 p-4 rounded-lg border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm text-gray-700">Recovery Codes</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                className="flex items-center gap-2"
              >
                {hasCopied ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy All
                  </>
                )}
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {codes.map((code, index) => (
                <div key={index} className="bg-white p-2 rounded border text-center">
                  {code}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm">How to use recovery codes:</h4>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>Each code can only be used once</li>
              <li>Use these codes when you don't have access to your authenticator app</li>
              <li>Store them in a password manager or print them and keep them secure</li>
              <li>Generate new codes if you suspect these have been compromised</li>
            </ul>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t">
            <Button
              onClick={handleAcknowledge}
              disabled={hasAcknowledged}
              className="bg-green-600 hover:bg-green-700"
            >
              {hasAcknowledged ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Acknowledged
                </>
              ) : (
                'I have safely stored my recovery codes'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 