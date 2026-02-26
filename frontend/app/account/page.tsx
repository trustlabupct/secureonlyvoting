'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Shield, Settings, Calendar, ChevronRight, User, AlertCircle, Home, ArrowLeft, Key } from 'lucide-react';
import { mfaService } from '@/lib/mfa-service';
import { accountService } from '@/lib/account-service';
import { withAuth } from '@/components/with-auth';

interface UserProfile {
  id: string;
  username: string;
  name: string;
  role: string;
  mfaEnabled: boolean;
  createdAt: string;
}

interface VotedPoll {
  id: string;
  title: string;
  votedAt: string;
  status: 'active' | 'closed' | 'draft';
}

function AccountPage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [votedPolls, setVotedPolls] = useState<VotedPoll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadAccountData();
  }, []);

  const loadAccountData = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Load user profile
      const profile = await accountService.getUserProfile();
      setUserProfile(profile);

      // Load voting history
      const votingHistory = await accountService.getVotingHistory();
      setVotedPolls(votingHistory);

    } catch (err) {
      console.error('Failed to load account data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load account data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaNavigation = () => {
    router.push('/account/security/mfa');
  };

  const handlePasswordNavigation = () => {
    router.push('/account/security/password');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'destructive';
      case 'user':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'closed':
        return 'secondary';
      case 'draft':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const censorWord = (str: string) => {
    if (str.length <= 2) return str;
    return str[0] + "*".repeat(Math.max(0, str.length - 2)) + str.slice(-1);
  };

  const censorEmail = (email?: string) => {
    if (!email || typeof email !== 'string') return '';
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    const [local, domain] = parts;
    return `${censorWord(local)}@${censorWord(domain)}`;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="h-48 bg-gray-200 rounded"></div>
              <div className="h-48 bg-gray-200 rounded"></div>
            </div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* Navigation Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <User className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">My Account</h1>
              <nav className="flex text-sm text-muted-foreground mt-1">
                <span>Dashboard</span>
                <span className="mx-2">›</span>
                <span className="text-foreground">Account</span>
              </nav>
            </div>
          </div>
          
          {/* Navigation Buttons */}
          <div className="flex items-center gap-3">
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

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {/* User Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {userProfile && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Name</label>
                    <p className="text-lg">{userProfile.name || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <div className="group relative">
                      <p className="text-lg transition-all duration-200 filter blur-sm group-hover:blur-none cursor-pointer select-none">
                        {userProfile.username || 'Not provided'}
                      </p>
                      <div className="absolute inset-0 flex items-center">
                        <p className="text-lg text-gray-400 transition-all duration-200 opacity-100 group-hover:opacity-0 pointer-events-none">
                          {censorEmail(userProfile.username)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Role</label>
                    <div className="mt-1">
                      <Badge variant={getRoleColor(userProfile.role)}>
                        {userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1)}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Member Since</label>
                    <p className="text-sm text-gray-600">
                      {userProfile.createdAt ? formatDate(userProfile.createdAt) : 'Unknown'}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Security Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-gray-500">
                    {userProfile?.mfaEnabled ? 'Enhanced security enabled' : 'Additional security available'}
                  </p>
                </div>
                <Badge variant={userProfile?.mfaEnabled ? 'default' : 'secondary'}>
                  {userProfile?.mfaEnabled ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              
              <Separator />
              
              <Button 
                onClick={handlePasswordNavigation}
                className="w-full mb-3"
                variant="outline"
              >
                <Key className="h-4 w-4 mr-2" />
                Modify Password
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>
              
              <Button 
                onClick={handleMfaNavigation}
                className="w-full"
                variant="outline"
              >
                <Settings className="h-4 w-4 mr-2" />
                Manage MFA Settings
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Voting History Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Voting History
            </CardTitle>
            <CardDescription>
              Polls you have participated in
            </CardDescription>
          </CardHeader>
          <CardContent>
            {votedPolls.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No voting history yet</p>
                <p className="text-sm">Your participated polls will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {votedPolls.map((poll) => (
                  <div key={poll.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex-1">
                      <h3 className="font-medium">{poll.title}</h3>
                      <p className="text-sm text-gray-500">
                        Voted on {formatDate(poll.votedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={getStatusColor(poll.status)}>
                        {poll.status.charAt(0).toUpperCase() + poll.status.slice(1)}
                      </Badge>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => router.push(`/polls/${poll.id}`)}
                      >
                        View
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default withAuth(AccountPage); 