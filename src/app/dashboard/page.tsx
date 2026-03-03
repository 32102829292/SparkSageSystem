"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Activity, Cpu, Wifi, WifiOff, Server, ArrowRight, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import type { ProviderItem, ProvidersResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const REFRESH_INTERVAL = 10000; // 10 seconds

interface BotStatus {
  online: boolean;
  username: string;
  latency_ms: number;
  guild_count: number;
  guilds: { id: string; name: string; member_count: number }[];
}

export default function DashboardOverview() {
  const { data: session, status } = useSession();

  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [providersData, setProvidersData] = useState<ProvidersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const token = (session as { accessToken?: string })?.accessToken;

  const fetchData = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    const results = await Promise.allSettled([
      api.getBotStatus(token),
      api.getProviders(token),
    ]);

    const botResult = results[0] as PromiseSettledResult<BotStatus>;
    const provResult = results[1] as PromiseSettledResult<ProvidersResponse>;

    if (botResult.status === "fulfilled") setBotStatus(botResult.value);
    if (provResult.status === "fulfilled") setProvidersData(provResult.value);

    if (botResult.status === "rejected" && provResult.status === "rejected") {
      setError("Failed to load dashboard data.");
    }

    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  // Initial fetch
  useEffect(() => {
    if (status === "loading" || !token) return;
    fetchData(false);
  }, [token, status, fetchData]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => fetchData(true), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [token, fetchData]);

  const primaryProvider = providersData?.providers.find(
    (p: ProviderItem) => p.is_primary
  );

  const latencyColor =
    botStatus?.latency_ms == null
      ? "text-muted-foreground"
      : botStatus.latency_ms < 100
      ? "text-green-600"
      : botStatus.latency_ms < 250
      ? "text-yellow-500"
      : "text-red-500";

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Overview</h1>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
        <span className="text-xs text-muted-foreground">Live — refreshes every 10s</span>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Bot Status</CardTitle>
            {botStatus?.online ? (
              <Wifi className="h-4 w-4 text-green-600" />
            ) : (
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <Badge variant={botStatus?.online ? "default" : "secondary"}>
              {botStatus?.online ? "Online" : "Offline"}
            </Badge>
            {botStatus?.username && (
              <p className="text-xs text-muted-foreground mt-1">{botStatus.username}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Latency</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${latencyColor}`}>
              {botStatus?.latency_ms != null
                ? `${Math.round(botStatus.latency_ms)}ms`
                : "--"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {botStatus?.latency_ms == null
                ? "--"
                : botStatus.latency_ms < 100
                ? "Excellent"
                : botStatus.latency_ms < 250
                ? "Good"
                : "High"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Servers</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{botStatus?.guild_count ?? "--"}</p>
            <p className="text-xs text-muted-foreground mt-1">Connected guilds</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Provider</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {primaryProvider ? (
              <>
                <p className="text-lg font-semibold">{primaryProvider.display_name}</p>
                <p className="text-xs text-muted-foreground">{primaryProvider.model}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">--</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Connected Servers */}
      {botStatus?.guilds?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connected Servers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {botStatus.guilds.map((guild) => (
                <div
                  key={guild.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <span className="text-sm font-medium">{guild.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {guild.member_count} members
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Fallback Chain */}
      {providersData?.fallback_order?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fallback Chain</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              {providersData.fallback_order.map((name, i) => {
                const prov = providersData.providers.find((p) => p.name === name);
                return (
                  <div key={name} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          prov?.configured ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                      <span className="text-sm">{prov?.display_name || name}</span>
                      {prov?.is_primary && (
                        <Badge variant="secondary" className="ml-1 text-xs">
                          Primary
                        </Badge>
                      )}
                    </div>
                    {i < providersData.fallback_order.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}