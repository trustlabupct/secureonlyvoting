"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getAuditLogs } from "@/lib/audit-logger"
import { AlertCircle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface VotingActivityMonitorProps {
  pollId?: string // Optional - if provided, only show logs for this poll
}

export function VotingActivityMonitor({ pollId }: VotingActivityMonitorProps) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filter, setFilter] = useState<string>("all")
  const [refreshInterval, setRefreshInterval] = useState<number>(10000) // 10 seconds

  const fetchLogs = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const filters: any = {}
      
      if (pollId) {
        filters.resourceId = pollId
      }
      
      if (filter === "success") {
        filters.success = true
      } else if (filter === "failed") {
        filters.success = false
      } else if (filter === "votes") {
        filters.action = "VOTE_SUBMITTED"
      }
      
      const result = await getAuditLogs(page, 10, filters)
      
      if (result) {
        setLogs(result.logs)
        setTotalPages(Math.ceil(result.total / result.pageSize))
      } else {
        setError("Failed to load audit logs")
      }
    } catch (err) {
      console.error("Error fetching audit logs:", err)
      setError("An error occurred while loading audit logs")
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch and set up polling
  useEffect(() => {
    fetchLogs()
    
    const intervalId = setInterval(fetchLogs, refreshInterval)
    
    return () => clearInterval(intervalId)
  }, [page, filter, pollId, refreshInterval])

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case "VOTE_SUBMITTED":
        return "text-green-600"
      case "VOTE_FAILED":
        return "text-red-600"
      case "POLL_CREATED":
      case "POLL_MODIFIED":
        return "text-blue-600"
      default:
        return "text-gray-600"
    }
  }

  const getStatusBadge = (success: boolean) => {
    return success ? (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="h-3 w-3 mr-1" />
        Success
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <AlertCircle className="h-3 w-3 mr-1" />
        Failed
      </span>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voting Activity Monitor</CardTitle>
        <CardDescription>
          {pollId ? "Real-time monitoring of voting activity for this poll" : "Real-time monitoring of all voting activity"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter logs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activity</SelectItem>
                  <SelectItem value="votes">Votes Only</SelectItem>
                  <SelectItem value="success">Successful Only</SelectItem>
                  <SelectItem value="failed">Failed Only</SelectItem>
                </SelectContent>
              </Select>
              
              <Select 
                value={refreshInterval.toString()} 
                onValueChange={(value) => setRefreshInterval(Number.parseInt(value))}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Refresh rate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5000">Refresh: 5s</SelectItem>
                  <SelectItem value="10000">Refresh: 10s</SelectItem>
                  <SelectItem value="30000">Refresh: 30s</SelectItem>
                  <SelectItem value="60000">Refresh: 1m</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
              Refresh Now
            </Button>
          </div>
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {loading ? (
            <div className="py-8 text-center">Loading activity logs...</div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No activity logs found</div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left">Time</th>
                      <th className="px-4 py-2 text-left">User</th>
                      <th className="px-4 py-2 text-left">Action</th>
                      <th className="px-4 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{formatTimestamp(log.timestamp)}</td>
                        <td className="px-4 py-2">
                          {log.userName || "Anonymous"} 
                          <span className="text-xs text-gray-500 ml-1">({log.userRole})</span>
                        </td>
                        <td className={`px-4 py-2 ${getActionColor(log.action)}`}>{log.action}</td>
                        <td className="px-4 py-2">{getStatusBadge(log.success)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {totalPages > 1 && (
                <div className="flex justify-between items-center pt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span>Page {page} of {totalPages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
