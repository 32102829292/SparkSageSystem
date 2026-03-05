"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Activity, Cpu, Wifi, WifiOff, Server, ArrowRight,
  RefreshCw, Plus, AlertCircle, ExternalLink, ChevronDown, ChevronUp
} from "lucide-react";
import { api } from "../../lib/api";
import type { ProviderItem, ProvidersResponse } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";

const REFRESH_INTERVAL = 10000;
const GUILDS_PREVIEW_COUNT = 5;

// Replace with your actual Discord OAuth invite URL
const DISCORD_INVITE_URL = `https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID}&permissions=8&scope=bot%20applications.commands`;

interface Guild {
  id: string;
  name: string;
  member_count: number;
  icon_url?: string | null;
}

interface BotStatus {
  online: boolean;
  username: string;
  latency_ms: number;
  guild_count: number;
  guilds: Guild[];
}

// --- Helpers ---

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "bg-indigo-500", "bg-violet-500", "bg-pink-500",
  "bg-rose-500", "bg-amber-500", "bg-emerald-500", "bg-sky-500",
];

function avatarColor(id: string): string {
  const n = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

// --- Sub-components ---

function GuildRow({ guild }: { guild: Guild }) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/40 transition-colors">
      <div className="flex items-center gap-3">
        {guild.icon_url ? (
          <img
            src={guild.icon_url}
            alt={guild.name}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div
            className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold ${avatarColor(guild.id)}`}
          >
            {getInitials(guild.name)}
          </div>
        )}
        <span className="text-sm font-medium">{guild.name}</span>
      </div>
      <span className="text-xs text-muted-foreground">
        {guild.member_count?.toLocaleString()} members
      </span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        <div className="h-4 w-4 bg-muted rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-7 w-16 bg-muted rounded animate-pulse mb-1" />
        <div className="h-3 w-24 bg-muted rounded animate-pulse" />
      </CardContent>
    </Card>
  );
}

function InstallModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  function openInvite() {
    window.open(DISCORD_INVITE_URL, "_blank", "width=500,height=800");
    setStep(2);
  }

  function handleDone() {
    onClose();
    // Trigger a page refresh of dashboard data after closing
    window.dispatchEvent(new CustomEvent("sparksage:refresh"));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Progress */}
        <div className="flex h-1">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 transition-colors duration-300 ${step >= s ? "bg-indigo-500" : "bg-muted"}`}
            />
          ))}
        </div>

        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Server className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">Add SparkSage to a Server</h2>
                  <p className="text-sm text-muted-foreground">Step 1 of 3 — Review permissions</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                SparkSage requires the following permissions to function correctly:
              </p>
              <ul className="space-y-2 text-sm">
                {[
                  ["Read Messages / View Channels", "To receive commands"],
                  ["Send Messages", "To respond in channels"],
                  ["Use Slash Commands", "For all /commands"],
                  ["Manage Messages", "For moderation features"],
                  ["Read Message History", "For conversation context"],
                ].map(([perm, desc]) => (
                  <li key={perm} className="flex items-start gap-2">
                    <span className="mt-0.5 h-4 w-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    </span>
                    <span>
                      <span className="font-medium">{perm}</span>
                      <span className="text-muted-foreground"> — {desc}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 border rounded-lg px-4 py-2 text-sm hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={openInvite}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  Continue <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                  <ExternalLink className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">Authorize in Discord</h2>
                  <p className="text-sm text-muted-foreground">Step 2 of 3 — Complete in the popup</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                A Discord authorization window should have opened. Select your server, confirm the permissions, and click <strong>Authorize</strong>.
              </p>
              <p className="text-sm text-muted-foreground">
                Didn't see it?{" "}
                <button onClick={openInvite} className="text-indigo-500 hover:underline">
                  Open again
                </button>
              </p>
              <button
                onClick={() => setStep(3)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                I've authorized it ✓
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center">
              <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <span className="text-2xl">🎉</span>
              </div>
              <div>
                <h2 className="font-semibold text-lg">SparkSage is ready!</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Your bot has been added. Here's what to do next:
                </p>
              </div>
              <ul className="text-left space-y-2 text-sm">
                {[
                  "Go to your Discord server",
                  "Run /ask to test the AI",
                  "Use /permissions to configure access",
                  "Set up /onboarding for new members",
                ].map((tip, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-semibold flex-shrink-0">
                      {i + 1}
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
              <button
                onClick={handleDone}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function DashboardOverview() {
  const { data: session, status } = useSession();

  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [providersData, setProvidersData] = useState<ProvidersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showAllGuilds, setShowAllGuilds] = useState(false);

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

  useEffect(() => {
    if (status === "loading" || !token) return;
    fetchData(false);
  }, [token, status, fetchData]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => fetchData(true), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [token, fetchData]);

  // Listen for refresh events from modal
  useEffect(() => {
    const handler = () => fetchData(true);
    window.addEventListener("sparksage:refresh", handler);
    return () => window.removeEventListener("sparksage:refresh", handler);
  }, [fetchData]);

  const primaryProvider = providersData?.providers.find((p: ProviderItem) => p.is_primary);

  const latencyColor =
    botStatus?.latency_ms == null
      ? "text-muted-foreground"
      : botStatus.latency_ms < 100
      ? "text-green-600"
      : botStatus.latency_ms < 250
      ? "text-yellow-500"
      : "text-red-500";

  const guilds = botStatus?.guilds ?? [];
  const visibleGuilds = showAllGuilds ? guilds : guilds.slice(0, GUILDS_PREVIEW_COUNT);
  const hasMoreGuilds = guilds.length > GUILDS_PREVIEW_COUNT;

  // --- Loading state ---
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 bg-muted rounded animate-pulse" />
          <div className="h-8 w-24 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-3 text-center min-h-[200px]">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-red-500 font-medium">{error}</p>
        <button
          onClick={() => fetchData(false)}
          className="flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-xs hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {showInstallModal && (
        <InstallModal onClose={() => setShowInstallModal(false)} />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Overview</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monitor your bot's status and connected servers
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground hidden sm:block">
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
            <button
              onClick={() => setShowInstallModal(true)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add to Server
            </button>
          </div>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs text-muted-foreground">Live — refreshes every 10s</span>
        </div>

        {/* "Add to Server" nudge banner — shown when online but no guilds */}
        {botStatus?.online && guilds.length === 0 && (
          <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-800 px-4 py-3">
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-indigo-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                  Your bot isn't in any servers yet
                </p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400">
                  Add SparkSage to a Discord server to get started
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowInstallModal(true)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-2 text-xs font-medium transition-colors flex-shrink-0"
            >
              Add to Server <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

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
                {botStatus?.latency_ms != null ? `${Math.round(botStatus.latency_ms)}ms` : "--"}
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
              <button
                onClick={() => setShowInstallModal(true)}
                className="text-xs text-indigo-500 hover:underline mt-1 flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add server
              </button>
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
        {guilds.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Connected Servers</CardTitle>
              <button
                onClick={() => setShowInstallModal(true)}
                className="text-xs text-indigo-500 hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add server
              </button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {visibleGuilds.map((guild) => (
                  <GuildRow key={guild.id} guild={guild} />
                ))}
              </div>
              {hasMoreGuilds && (
                <button
                  onClick={() => setShowAllGuilds((v) => !v)}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showAllGuilds ? (
                    <><ChevronUp className="h-3.5 w-3.5" /> Show less</>
                  ) : (
                    <><ChevronDown className="h-3.5 w-3.5" /> Show {guilds.length - GUILDS_PREVIEW_COUNT} more</>
                  )}
                </button>
              )}
            </CardContent>
          </Card>
        )}

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
                          <Badge variant="secondary" className="ml-1 text-xs">Primary</Badge>
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
    </>
  );
}