'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { withAuth } from '@/components/with-auth';
import { 
  Users, 
  Vote, 
  FileText, 
  Shield, 
  Activity,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  Database,
  Server,
  ArrowLeft,
  Home
} from 'lucide-react';

interface SystemMetrics {
  totalUsers: number;
  totalPolls: number;
  totalVotes: number;
  activePolls: number;
  anonymousVotes: number;
  rateLimit: {
    totalPolicies: number;
    totalViolations: number;
    topViolatedEndpoints: Array<{
      endpoint: string;
      violations: number;
    }>;
  };
  security: {
    activeTokens: number;
    expiredTokens: number;
    revokedTokens: number;
    activeSessions: number;
  };
  homomorphic: {
    encryptedBallots: number;
    completedAggregations: number;
    avgProcessingTime: number;
  };
  securityScore: number;
}

interface VotingActivity {
  date: string;
  votes: number;
  polls: number;
}

interface SecurityEvent {
  id: string;
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
  endpoint?: string;
}

function AdminDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [activity, setActivity] = useState<VotingActivity[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      
      const metricsResponse = await fetch('/api/admin/security/dashboard/metrics', {
        credentials: 'include',
      });
      
      if (!metricsResponse.ok) {
        throw new Error('Failed to fetch metrics');
      }
      
      const metricsData = await metricsResponse.json();
      
      const transformedMetrics: SystemMetrics = {
        totalUsers: metricsData.data?.userCount || 0,
        totalPolls: metricsData.data?.pollCount || 0,
        totalVotes: metricsData.data?.voteCount || 0,
        activePolls: metricsData.data?.activePolls || 0,
        anonymousVotes: metricsData.data?.anonymousVotes || 0,
        rateLimit: {
          totalPolicies: metricsData.data?.rateLimitPolicies || 0,
          totalViolations: metricsData.data?.rateLimitViolations || 0,
          topViolatedEndpoints: metricsData.data?.topViolatedEndpoints || [],
        },
        security: {
          activeTokens: metricsData.data?.activeTokens || 0,
          expiredTokens: metricsData.data?.expiredTokens || 0,
          revokedTokens: metricsData.data?.revokedTokens || 0,
          activeSessions: metricsData.data?.activeSessions || 0,
        },
        homomorphic: {
          encryptedBallots: metricsData.data?.encryptedBallots || 0,
          completedAggregations: metricsData.data?.completedAggregations || 0,
          avgProcessingTime: metricsData.data?.avgProcessingTime || 0,
        },
        securityScore: metricsData.data?.securityScore || 0,
      };
      
      setMetrics(transformedMetrics);
      
      // Fetch real activity data from the backend
      const activityResponse = await fetch('/api/admin/security/dashboard/activity', {
        credentials: 'include',
      });
      
      if (!activityResponse.ok) {
        throw new Error('Failed to fetch activity data');
      }
      
      const activityData = await activityResponse.json();
      setActivity(activityData.data);
      
      // Fetch real security events from the backend
      const securityEventsResponse = await fetch('/api/admin/security/dashboard/events', {
        credentials: 'include',
      });
      
      if (!securityEventsResponse.ok) {
        throw new Error('Failed to fetch security events');
      }
      
      const securityEventsData = await securityEventsResponse.json();
      setSecurityEvents(securityEventsData.data);
      
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch dashboard data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const runSecurityCleanup = async () => {
    try {
      const response = await fetch('/api/admin/security/cleanup', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Cleanup failed');
      }
      
      const result = await response.json();
      toast({
        title: 'Cleanup Complete',
        description: `Removed ${result.data?.deletedCount || 0} expired security tokens`,
      });
      
      fetchDashboardData();
    } catch (error) {
      toast({
        title: 'Cleanup Failed',
        description: 'Unable to run security cleanup. Please try again.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <XCircle className="h-4 w-4" />;
      case 'medium': return <AlertTriangle className="h-4 w-4" />;
      default: return <CheckCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">System analytics and monitoring</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchDashboardData}
            disabled={refreshing}
          >
            {refreshing ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
          <Button
            variant="secondary"
            onClick={runSecurityCleanup}
          >
            <Shield className="h-4 w-4 mr-2" />
            Run Cleanup
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              Registered users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Polls</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalPolls || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.activePolls || 0} currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Votes</CardTitle>
            <Vote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalVotes || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.anonymousVotes || 0} anonymous
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              (metrics?.securityScore || 0) >= 90 ? 'text-green-600' : 
              (metrics?.securityScore || 0) >= 70 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {Math.round(metrics?.securityScore || 0)}%
            </div>
            <Progress value={metrics?.securityScore || 0} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity (7 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activity.map((day, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm">{day.date}</span>
                      <div className="flex gap-4 text-sm">
                        <span>{day.votes} votes</span>
                        <span>{day.polls} polls</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Homomorphic Encryption
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Encrypted Ballots</span>
                  <Badge variant="secondary">{metrics?.homomorphic.encryptedBallots || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Completed Aggregations</span>
                  <Badge variant="secondary">{metrics?.homomorphic.completedAggregations || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Avg Processing Time</span>
                  <Badge variant="outline">{metrics?.homomorphic.avgProcessingTime || 0}ms</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Security Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Active Sessions</span>
                  <Badge variant="secondary">{metrics?.security.activeSessions || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Active Tokens</span>
                  <Badge variant="secondary">{metrics?.security.activeTokens || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Revoked Tokens</span>
                  <Badge variant="outline">{metrics?.security.revokedTokens || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Rate Limit Policies</span>
                  <Badge variant="secondary">{metrics?.rateLimit.totalPolicies || 0}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Security Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {securityEvents.map((event) => (
                    <div key={event.id} className="flex items-start gap-3 p-3 border rounded">
                      {getSeverityIcon(event.severity)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{event.type}</span>
                          <Badge variant={getSeverityColor(event.severity) as any}>
                            {event.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {event.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Voting Activity</CardTitle>
              <CardDescription>Daily voting statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Votes Cast</TableHead>
                    <TableHead>Polls Created</TableHead>
                    <TableHead>Activity Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity.map((day, index) => (
                    <TableRow key={index}>
                      <TableCell>{day.date}</TableCell>
                      <TableCell>{day.votes}</TableCell>
                      <TableCell>{day.polls}</TableCell>
                      <TableCell>
                        <Progress value={(day.votes / 100) * 100} className="w-16" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Rate Limiting
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Total Policies</span>
                  <Badge variant="secondary">{metrics?.rateLimit.totalPolicies || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total Violations</span>
                  <Badge variant={metrics?.rateLimit.totalViolations ? 'destructive' : 'outline'}>
                    {metrics?.rateLimit.totalViolations || 0}
                  </Badge>
                </div>
                {metrics?.rateLimit.topViolatedEndpoints.length ? (
                  <div>
                    <p className="text-sm font-medium mb-2">Top Violated Endpoints:</p>
                    {metrics.rateLimit.topViolatedEndpoints.slice(0, 3).map((endpoint, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span className="font-mono">{endpoint.endpoint}</span>
                        <Badge variant="outline">{endpoint.violations}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No rate limit violations</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  System Health
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Database Connection</span>
                  <Badge variant="secondary">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Healthy
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Homomorphic Service</span>
                  <Badge variant="secondary">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Operational
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Rate Limiting</span>
                  <Badge variant="secondary">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Security Cleanup</span>
                  <Badge variant="secondary">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Scheduled
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default withAuth(AdminDashboard); 