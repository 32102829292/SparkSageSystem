"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { 
  Loader2, 
  Activity, 
  RefreshCw, 
  Zap,
  MessageSquare,
  Clock,
  Hash,
  TrendingUp,
  AlertCircle
} from "lucide-react";

const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

interface AnalyticsStats {
  total_messages: number;
  total_responses: number;
  avg_latency_ms: number;
  active_channels: number;
  by_provider: Record<string, number>;
  daily: { date: string; count: number }[];
  hourly?: { hour: string; count: number }[];
  top_channels?: { name: string; count: number }[];
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [period, setPeriod] = useState("7d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const token = (session as { accessToken?: string })?.accessToken;

  // Fetch analytics data
  const fetchAnalytics = useCallback(async (showRefreshingState = false) => {
    if (!token) return null;

    try {
      if (showRefreshingState) {
        setRefreshing(true);
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/analytics/summary?period=${period}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error("Failed to fetch analytics");
      }

      const data: AnalyticsStats = await res.json();
      setStats(data);
      setLastUpdated(new Date());
      setError(null);
      return data;
    } catch (err) {
      setError("Unable to load analytics data.");
      setStats(null);
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, period]);

  // Initial data fetch
  useEffect(() => {
    if (status === "loading") return;
    if (!token) {
      setLoading(false);
      return;
    }

    fetchAnalytics();
  }, [token, period, status, fetchAnalytics]);

  // Auto-refresh polling
  useEffect(() => {
    if (!autoRefresh || !token) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Poll every 30 seconds when auto-refresh is enabled
    pollingIntervalRef.current = setInterval(() => {
      fetchAnalytics(true);
    }, 30000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [autoRefresh, token, fetchAnalytics]);

  const handleRefresh = useCallback(async () => {
    await fetchAnalytics(true);
  }, [fetchAnalytics]);

  const toggleAutoRefresh = useCallback(() => {
    setAutoRefresh(prev => !prev);
  }, []);

  // Prepare chart data
  const providerData = stats?.by_provider
    ? Object.entries(stats.by_provider).map(([name, count]) => ({
        name,
        count,
      }))
    : [];

  const dailyData = stats?.daily ?? [];
  const hourlyData = stats?.hourly ?? [];
  const topChannels = stats?.top_channels ?? [];

  // Calculate derived metrics
  const responseRate = stats?.total_messages 
    ? Math.round((stats.total_responses / stats.total_messages) * 100) 
    : 0;

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Unauthenticated state
  if (status === "unauthenticated") {
    return (
      <Card className="border-destructive max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-destructive">Authentication Required</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Please sign in to view analytics.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Metrics and insights from your Discord bot
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-refresh toggle */}
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={toggleAutoRefresh}
            className="gap-1"
          >
            <Activity className="h-3 w-3" />
            {autoRefresh ? 'Auto (30s)' : 'Manual'}
          </Button>

          {/* Manual refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>

          {/* Period select */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="today">Today</option>
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {/* Last updated */}
      {lastUpdated && (
        <p className="text-xs text-muted-foreground">
          Last updated: {lastUpdated.toLocaleTimeString()}
          {autoRefresh && ' (auto-refreshing every 30s)'}
        </p>
      )}

      {error ? (
        <Card className="border-destructive">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-8 w-8 mx-auto text-destructive mb-2" />
            <p className="text-destructive">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              className="mt-4"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : stats ? (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { 
                label: "Total Messages", 
                value: stats.total_messages,
                icon: MessageSquare,
                color: "text-blue-500"
              },
              { 
                label: "AI Responses", 
                value: stats.total_responses,
                icon: Zap,
                color: "text-purple-500"
              },
              { 
                label: "Avg Latency", 
                value: `${stats.avg_latency_ms}ms`,
                icon: Clock,
                color: "text-green-500"
              },
              { 
                label: "Active Channels", 
                value: stats.active_channels,
                icon: Hash,
                color: "text-orange-500"
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                  <p className="text-2xl font-bold mt-1">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Response Rate Card */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Response Rate</p>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </div>
                <p className="text-2xl font-bold mt-1">{responseRate}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Line Chart */}
          {dailyData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Messages Per Day
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Hourly Data */}
          {hourlyData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Hourly Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      fill="#8b5cf6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Provider Charts */}
          {providerData.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    Provider Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={providerData}
                        dataKey="count"
                        nameKey="name"
                        outerRadius={80}
                        label={({ name, percent = 0 }) => 
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {providerData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={COLORS[i % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    Requests by Provider
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={providerData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar
                        dataKey="count"
                        fill="#6366f1"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Top Channels */}
          {topChannels.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Top Active Channels
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topChannels.map((channel, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm">#{channel.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{channel.count}</span>
                        <div 
                          className="h-2 bg-indigo-500 rounded-full"
                          style={{ 
                            width: `${(channel.count / Math.max(...topChannels.map(c => c.count))) * 100}px`,
                            maxWidth: '200px'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No analytics data yet. Start using the bot to see stats here.
          </CardContent>
        </Card>
      )}
    </div>
  );
}