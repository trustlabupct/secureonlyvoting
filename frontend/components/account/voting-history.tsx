'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { handleApiError } from '@/lib/enhanced-error-handler';
import { 
  History, 
  Vote, 
  Calendar, 
  Clock, 
  User, 
  Users,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import Link from 'next/link';

interface VoteHistoryItem {
  id: string;
  pollId: string;
  pollTitle: string;
  pollDescription?: string;
  voteDate: string;
  isAnonymous: boolean;
  votingMechanism: string;
  selectedOptions?: Array<{
    id: string;
    text: string;
  }>;
  rankings?: Array<{
    optionId: string;
    optionText: string;
    rank: number;
  }>;
  ratings?: Array<{
    optionId: string;
    optionText: string;
    rating: number;
  }>;
  pollStatus: 'active' | 'completed' | 'upcoming';
  pollEndTime: string;
  canViewResults: boolean;
}

interface VotingStats {
  totalVotes: number;
  anonymousVotes: number;
  publicVotes: number;
  votingMechanisms: Record<string, number>;
  recentActivity: number; // votes in last 30 days
}

export function VotingHistory() {
  const [history, setHistory] = useState<VoteHistoryItem[]>([]);
  const [stats, setStats] = useState<VotingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAnonymous, setShowAnonymous] = useState(true);
  const { toast } = useToast();

  const fetchVotingHistory = async () => {
    try {
      setRefreshing(true);
      
      const response = await fetch('/api/votes/history', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform the backend data to match our interface
      const transformedHistory: VoteHistoryItem[] = data.map((item: any) => ({
        id: item.id,
        pollId: item.pollId,
        pollTitle: item.poll?.title || 'Unknown Poll',
        pollDescription: item.poll?.description,
        voteDate: item.createdAt,
        isAnonymous: item.poll?.isAnonymous || false,
        votingMechanism: item.poll?.votingMechanism || 'single',
        selectedOptions: item.selectedOptions || [],
        rankings: item.rankings || [],
        ratings: item.ratings || [],
        pollStatus: determinePollStatus(item.poll?.startTime, item.poll?.endTime),
        pollEndTime: item.poll?.endTime,
        canViewResults: item.poll?.isPublic || item.poll?.endTime < new Date().toISOString(),
      }));

      setHistory(transformedHistory);
      
      // Calculate stats
      const votingStats: VotingStats = {
        totalVotes: transformedHistory.length,
        anonymousVotes: transformedHistory.filter(v => v.isAnonymous).length,
        publicVotes: transformedHistory.filter(v => !v.isAnonymous).length,
        votingMechanisms: {},
        recentActivity: 0,
      };

      // Count voting mechanisms
      transformedHistory.forEach(vote => {
        votingStats.votingMechanisms[vote.votingMechanism] = 
          (votingStats.votingMechanisms[vote.votingMechanism] || 0) + 1;
      });

      // Count recent activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      votingStats.recentActivity = transformedHistory.filter(
        vote => new Date(vote.voteDate) >= thirtyDaysAgo
      ).length;

      setStats(votingStats);

    } catch (error) {
      handleApiError(error, {
        context: 'Failed to load voting history',
        showToast: true,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const determinePollStatus = (startTime?: string, endTime?: string): 'active' | 'completed' | 'upcoming' => {
    if (!startTime || !endTime) return 'completed';
    
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (now < start) return 'upcoming';
    if (now > end) return 'completed';
    return 'active';
  };

  const formatVotingMechanism = (mechanism: string): string => {
    const mechanisms: Record<string, string> = {
      single: 'Single Choice',
      multiple: 'Multiple Choice',
      ranked: 'Ranked Choice',
      approval: 'Approval Voting',
      rating: 'Rating Scale',
    };
    return mechanisms[mechanism] || mechanism;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderVoteDetails = (vote: VoteHistoryItem) => {
    if (vote.isAnonymous && !showAnonymous) {
      return (
        <div className="flex items-center text-muted-foreground">
          <EyeOff className="h-4 w-4 mr-1" />
          Anonymous vote (hidden)
        </div>
      );
    }

    if (vote.selectedOptions && vote.selectedOptions.length > 0) {
      return (
        <div>
          <span className="text-sm font-medium">Selected: </span>
          <span className="text-sm">
            {vote.selectedOptions.map(option => option.text).join(', ')}
          </span>
        </div>
      );
    }

    if (vote.rankings && vote.rankings.length > 0) {
      return (
        <div>
          <span className="text-sm font-medium">Rankings: </span>
          <div className="text-sm">
            {vote.rankings
              .sort((a, b) => a.rank - b.rank)
              .map(ranking => `${ranking.rank}. ${ranking.optionText}`)
              .join(', ')}
          </div>
        </div>
      );
    }

    if (vote.ratings && vote.ratings.length > 0) {
      return (
        <div>
          <span className="text-sm font-medium">Ratings: </span>
          <div className="text-sm">
            {vote.ratings.map(rating => `${rating.optionText}: ${rating.rating}/10`).join(', ')}
          </div>
        </div>
      );
    }

    return <span className="text-sm text-muted-foreground">Vote recorded</span>;
  };

  useEffect(() => {
    fetchVotingHistory();
  }, []);

  const filteredHistory = showAnonymous 
    ? history 
    : history.filter(vote => !vote.isAnonymous);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Voting History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Votes</p>
                  <p className="text-2xl font-bold">{stats.totalVotes}</p>
                </div>
                <Vote className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Recent Activity</p>
                  <p className="text-2xl font-bold">{stats.recentActivity}</p>
                  <p className="text-xs text-muted-foreground">Last 30 days</p>
                </div>
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Public Votes</p>
                  <p className="text-2xl font-bold">{stats.publicVotes}</p>
                </div>
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Anonymous Votes</p>
                  <p className="text-2xl font-bold">{stats.anonymousVotes}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main History Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Voting History
              </CardTitle>
              <CardDescription>
                Your complete voting history across all polls
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAnonymous(!showAnonymous)}
              >
                {showAnonymous ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Hide Anonymous
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Show Anonymous
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchVotingHistory}
                disabled={refreshing}
              >
                {refreshing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredHistory.length === 0 ? (
            <div className="text-center py-8">
              <Vote className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No votes yet</h3>
              <p className="text-muted-foreground mb-4">
                You haven't participated in any polls yet.
              </p>
              <Button asChild>
                <Link href="/dashboard">Browse Polls</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Poll</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Vote Details</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.map((vote) => (
                  <TableRow key={vote.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{vote.pollTitle}</p>
                        {vote.pollDescription && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {vote.pollDescription}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline">
                          {formatVotingMechanism(vote.votingMechanism)}
                        </Badge>
                        {vote.isAnonymous && (
                          <Badge variant="secondary" className="text-xs">
                            Anonymous
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {renderVoteDetails(vote)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(vote.voteDate).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={getStatusColor(vote.pollStatus)}
                      >
                        {vote.pollStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/polls/${vote.pollId}`}>
                            View Poll
                          </Link>
                        </Button>
                        {vote.canViewResults && (
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/polls/${vote.pollId}/results`}>
                              Results
                            </Link>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 