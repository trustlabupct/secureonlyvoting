"use client"

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  Calculator, 
  Key, 
  Database, 
  TrendingUp, 
  Users, 
  Loader2,
  CheckCircle,
  AlertTriangle,
  Lock,
  Unlock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EncryptionParams {
  publicKey: string;
  encryptionParams: any;
  schemeType: string;
}

interface AggregateResult {
  aggregateCiphertext: string;
  ballotCount: number;
}

interface DecryptionResult {
  result: number;
}

interface TallyServiceHealth {
  ready: boolean;
  timestamp: string;
  service: string;
}

interface HomomorphicTallyAdminProps {
  pollId: string;
  authToken: string;
  isAnonymousPoll: boolean;
}

export function HomomorphicTallyAdmin({ pollId, authToken, isAnonymousPoll }: HomomorphicTallyAdminProps) {
  const { toast } = useToast();
  
  // State management
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [serviceHealth, setServiceHealth] = useState<TallyServiceHealth | null>(null);
  const [encryptionParams, setEncryptionParams] = useState<EncryptionParams | null>(null);
  const [aggregateResult, setAggregateResult] = useState<AggregateResult | null>(null);
  const [decryptionResult, setDecryptionResult] = useState<DecryptionResult | null>(null);
  const [ballotCount, setBallotCount] = useState<number>(0);

  // Set loading state helper
  const setOperationLoading = (operation: string, isLoading: boolean) => {
    setLoading(prev => ({ ...prev, [operation]: isLoading }));
  };

  // Check tally service health
  const checkServiceHealth = async () => {
    try {
      setOperationLoading('health', true);
      const response = await fetch('/api/tally/health');
      
      if (!response.ok) {
        throw new Error('Service health check failed');
      }
      
      const health = await response.json();
      setServiceHealth(health);
      
      if (health.ready) {
        toast({
          title: "Service Ready",
          description: "Homomorphic encryption service is operational",
        });
      }
    } catch (error) {
      console.error('Health check failed:', error);
      toast({
        title: "Service Error",
        description: "Failed to check tally service status",
        variant: "destructive",
      });
    } finally {
      setOperationLoading('health', false);
    }
  };

  // Get encryption parameters
  const getEncryptionParams = async () => {
    if (!isAnonymousPoll) {
      toast({
        title: "Not Available",
        description: "Homomorphic encryption only available for anonymous polls",
        variant: "destructive",
      });
      return;
    }

    try {
      setOperationLoading('params', true);
      const response = await fetch(`/api/tally/params/${pollId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get encryption parameters');
      }
      
      const params = await response.json();
      setEncryptionParams(params);
      
      toast({
        title: "Parameters Retrieved",
        description: "Encryption parameters loaded successfully",
      });
    } catch (error) {
      console.error('Error getting encryption params:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to get encryption parameters',
        variant: "destructive",
      });
    } finally {
      setOperationLoading('params', false);
    }
  };

  // Aggregate encrypted votes
  const aggregateVotes = async () => {
    if (!isAnonymousPoll) {
      toast({
        title: "Not Available",
        description: "Vote aggregation only available for anonymous polls",
        variant: "destructive",
      });
      return;
    }

    try {
      setOperationLoading('aggregate', true);
      const response = await fetch(`/api/tally/aggregate/${pollId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to aggregate votes');
      }
      
      const result = await response.json();
      setAggregateResult(result);
      setBallotCount(result.ballotCount);
      
      toast({
        title: "Aggregation Complete",
        description: `Successfully aggregated ${result.ballotCount} encrypted ballots`,
      });
    } catch (error) {
      console.error('Error aggregating votes:', error);
      toast({
        title: "Aggregation Failed",
        description: error instanceof Error ? error.message : 'Failed to aggregate votes',
        variant: "destructive",
      });
    } finally {
      setOperationLoading('aggregate', false);
    }
  };

  // Decrypt aggregated result
  const decryptResult = async () => {
    if (!aggregateResult) {
      toast({
        title: "No Data",
        description: "Please aggregate votes first",
        variant: "destructive",
      });
      return;
    }

    try {
      setOperationLoading('decrypt', true);
      const response = await fetch('/api/tally/decrypt', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aggregateCiphertext: aggregateResult.aggregateCiphertext,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to decrypt result');
      }
      
      const result = await response.json();
      setDecryptionResult(result);
      
      toast({
        title: "Decryption Complete",
        description: `Final tally: ${result.result}`,
      });
    } catch (error) {
      console.error('Error decrypting result:', error);
      toast({
        title: "Decryption Failed",
        description: error instanceof Error ? error.message : 'Failed to decrypt result',
        variant: "destructive",
      });
    } finally {
      setOperationLoading('decrypt', false);
    }
  };

  // Cleanup encrypted ballots
  const cleanupBallots = async () => {
    try {
      setOperationLoading('cleanup', true);
      const response = await fetch(`/api/tally/cleanup/${pollId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to cleanup ballots');
      }
      
      const result = await response.json();
      
      toast({
        title: "Cleanup Complete",
        description: `Cleaned up ${result.deletedCount} encrypted ballots`,
      });
      
      // Reset state after cleanup
      setAggregateResult(null);
      setDecryptionResult(null);
      setBallotCount(0);
    } catch (error) {
      console.error('Error cleaning up ballots:', error);
      toast({
        title: "Cleanup Failed",
        description: error instanceof Error ? error.message : 'Failed to cleanup ballots',
        variant: "destructive",
      });
    } finally {
      setOperationLoading('cleanup', false);
    }
  };

  // Auto-check service health on mount
  useEffect(() => {
    checkServiceHealth();
  }, []);

  if (!isAnonymousPoll) {
    return (
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Homomorphic encryption is only available for anonymous polls. This poll uses traditional voting mechanisms.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Homomorphic Tally Administration
          </CardTitle>
          <CardDescription>
            Manage encrypted vote aggregation and decryption for anonymous polling
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="operations">Operations</TabsTrigger>
              <TabsTrigger value="encryption">Encryption</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Service Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {serviceHealth?.ready ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Ready
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Not Ready
                        </Badge>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={checkServiceHealth}
                        disabled={loading.health}
                      >
                        {loading.health && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        Refresh
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Encrypted Ballots
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{ballotCount}</div>
                    <p className="text-xs text-muted-foreground">
                      {ballotCount > 0 ? 'Ready for aggregation' : 'No ballots yet'}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Final Result
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {decryptionResult ? decryptionResult.result : '—'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {decryptionResult ? 'Decrypted successfully' : 'Pending decryption'}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Operations Tab */}
            <TabsContent value="operations" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button 
                  onClick={aggregateVotes} 
                  disabled={loading.aggregate || !serviceHealth?.ready}
                  className="w-full"
                >
                  {loading.aggregate && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Calculator className="h-4 w-4 mr-2" />
                  Aggregate Encrypted Votes
                </Button>

                <Button 
                  onClick={decryptResult} 
                  disabled={loading.decrypt || !aggregateResult}
                  variant="outline"
                  className="w-full"
                >
                  {loading.decrypt && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Unlock className="h-4 w-4 mr-2" />
                  Decrypt Final Result
                </Button>

                <Button 
                  onClick={getEncryptionParams} 
                  disabled={loading.params}
                  variant="secondary"
                  className="w-full"
                >
                  {loading.params && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Key className="h-4 w-4 mr-2" />
                  Get Encryption Parameters
                </Button>

                <Button 
                  onClick={cleanupBallots} 
                  disabled={loading.cleanup}
                  variant="destructive"
                  className="w-full"
                >
                  {loading.cleanup && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Database className="h-4 w-4 mr-2" />
                  Cleanup Encrypted Ballots
                </Button>
              </div>

              {/* Progress Indicators */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Aggregation Progress</span>
                  <span>{aggregateResult ? '100%' : '0%'}</span>
                </div>
                <Progress value={aggregateResult ? 100 : 0} className="w-full" />
              </div>
            </TabsContent>

            {/* Encryption Tab */}
            <TabsContent value="encryption" className="space-y-4">
              {encryptionParams ? (
                <div className="space-y-4">
                  <Alert>
                    <Key className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Scheme:</strong> {encryptionParams.schemeType}
                      <br />
                      <strong>Public Key:</strong> {encryptionParams.publicKey.substring(0, 64)}...
                    </AlertDescription>
                  </Alert>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Encryption Parameters</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                        {JSON.stringify(encryptionParams.encryptionParams, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Alert>
                  <Lock className="h-4 w-4" />
                  <AlertDescription>
                    No encryption parameters loaded. Click "Get Encryption Parameters" to fetch them.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            {/* Results Tab */}
            <TabsContent value="results" className="space-y-4">
              {aggregateResult && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Aggregation Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <strong>Ballot Count:</strong> {aggregateResult.ballotCount}
                      </div>
                      <div>
                        <strong>Aggregate Ciphertext:</strong>
                        <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                          {aggregateResult.aggregateCiphertext.substring(0, 200)}...
                        </pre>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {decryptionResult && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Final Decrypted Result</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-primary mb-2">
                        {decryptionResult.result}
                      </div>
                      <p className="text-muted-foreground">
                        Total votes in favor (Yes votes for binary polls)
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!aggregateResult && !decryptionResult && (
                <Alert>
                  <TrendingUp className="h-4 w-4" />
                  <AlertDescription>
                    No results available yet. Perform vote aggregation and decryption first.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
} 