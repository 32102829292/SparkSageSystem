"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Activity, Cpu, Wifi, WifiOff, Server, ArrowRight,
  RefreshCw, Plus, AlertCircle, ExternalLink, ChevronDown, ChevronUp,
  Users, Trash2, RotateCcw, Zap, CheckCircle2, XCircle, Clock,
  Terminal
} from "lucide-react";
import { api } from "../../lib/api";
import type { ProviderItem, ProvidersResponse } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";

const REFRESH_INTERVAL = 10000;
const GUILDS_PREVIEW_COUNT = 5;

const DISCORD_INVITE_URL = `https://discord.com/oauth2/authorize?client_id=1473877049503518843&permissions=8&scope=bot%20applications.commands`;

// --- Types ---

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

interface ActivityEntry {
  command: string;
  user: string;
  guild: string;
  timestamp: string;
}

type QuickActionState = "idle" | "loading" | "success" | "error";

// --- Helpers ---

function getInitials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const AVATAR_COLORS = [
  "bg-indigo-500", "bg-violet-500", "bg-pink-500",
  "bg-rose-500", "bg-amber-500", "bg-emerald-500", "bg-sky-500",
];

function avatarColor(id: string): string {
  const n = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// --- Sub-components ---

function GuildRow({ guild }: { guild: Guild }) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/40 transition-colors">
      <div className="flex items-center gap-3">
        {guild.icon_url ? (
          <img src={guild.icon_url} alt={guild.name} className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold ${avatarColor(guild.id)}`}>
            {getInitials(guild.name)}
          </div>
        )}
        <span className="text-sm font-medium">{guild.name}</span>
      </div>
      <span className="text-xs text-muted-foreground">{guild.member_count?.toLocaleString()} members</span>
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
    window.dispatchEvent(new CustomEvent("sparksage:refresh"));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex h-1">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex-1 transition-colors duration-300 ${step >= s ? "bg-indigo-500" : "bg-muted"}`} />
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
              <p className="text-sm text-muted-foreground">SparkSage requires the following permissions to function correctly:</p>
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
                <button onClick={onClose} className="flex-1 border rounded-lg px-4 py-2 text-sm hover:bg-muted transition-colors">Cancel</button>
                <button onClick={openInvite} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors">
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
                <button onClick={openInvite} className="text-indigo-500 hover:underline">Open again</button>
              </p>
              <button onClick={() => setStep(3)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
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
                <p className="text-sm text-muted-foreground mt-1">Your bot has been added. Here's what to do next:</p>
              </div>
              <ul className="text-left space-y-2 text-sm">
                {["Go to your Discord server", "Run /ask to test the AI", "Use /permissions to configure access", "Set up /onboarding for new members"].map((tip, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-semibold flex-shrink-0">{i + 1}</span>
                    {tip}
                  </li>
                ))}
              </ul>
              <button onClick={handleDone} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HealthDot({ status }: { status: "healthy" | "degraded" | "down" | "unconfigured" }) {
  const map = { healthy: "bg-green-500", degraded: "bg-yellow-500", down: "bg-red-500", unconfigured: "bg-gray-300" };
  return <span className={`inline-block h-2 w-2 rounded-full ${map[status]}`} />;
}

function QuickActionButton({
  icon: Icon, label, description, state, variant = "default", onClick,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  state: QuickActionState;
  variant?: "default" | "danger";
  onClick: () => void;
}) {
  const isLoading = state === "loading";
  const isSuccess = state === "success";
  const isError = state === "error";

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`flex items-center gap-3 w-full rounded-lg border px-4 py-3 text-left transition-all hover:bg-muted/50 disabled:opacity-60
        ${variant === "danger" ? "hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/20" : ""}
        ${isSuccess ? "border-green-300 bg-green-50 dark:bg-green-950/20" : ""}
        ${isError ? "border-red-300 bg-red-50 dark:bg-red-950/20" : ""}
      `}
    >
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0
        ${isSuccess ? "bg-green-100 dark:bg-green-900/30" : isError ? "bg-red-100 dark:bg-red-900/30" : variant === "danger" ? "bg-red-100 dark:bg-red-900/30" : "bg-muted"}
      `}>
        {isLoading ? <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          : isSuccess ? <CheckCircle2 className="h-4 w-4 text-green-600" />
          : isError ? <XCircle className="h-4 w-4 text-red-500" />
          : <Icon className={`h-4 w-4 ${variant === "danger" ? "text-red-500" : "text-muted-foreground"}`} />}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground truncate">
          {isSuccess ? "Done!" : isError ? "Failed — try again" : description}
        </p>
      </div>
    </button>
  );
}

// --- Main Component ---

export default function DashboardOverview() {
  const { data: session, status } = useSession();

  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [providersData, setProvidersData] = useState<ProvidersResponse | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showAllGuilds, setShowAllGuilds] = useState(false);
  const [quickActions, setQuickActions] = useState<Record<string, QuickActionState>>({
    clearHistory: "idle",
    syncCommands: "idle",
    restartBot: "idle",
  });

  const token = (session as { accessToken?: string })?.accessToken;

  const fetchData = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    const results = await Promise.allSettled([
      api.getBotStatus(token),
      api.getProviders(token),
      api.getRecentActivity?.(token).catch(() => []),
    ]);

    const botResult = results[0] as PromiseSettledResult<BotStatus>;
    const provResult = results[1] as PromiseSettledResult<ProvidersResponse>;
    const actResult = results[2] as PromiseSettledResult<ActivityEntry[]>;

    if (botResult.status === "fulfilled") setBotStatus(botResult.value);
    if (provResult.status === "fulfilled") setProvidersData(provResult.value);
    if (actResult.status === "fulfilled" && Array.isArray(actResult.value)) setActivity(actResult.value);

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

  useEffect(() => {
    const handler = () => fetchData(true);
    window.addEventListener("sparksage:refresh", handler);
    return () => window.removeEventListener("sparksage:refresh", handler);
  }, [fetchData]);

  function setQuickAction(key: string, state: QuickActionState) {
    setQuickActions((prev) => ({ ...prev, [key]: state }));
    if (state === "success" || state === "error") {
      setTimeout(() => setQuickActions((prev) => ({ ...prev, [key]: "idle" })), 3000);
    }
  }

  async function handleClearHistory() {
    if (!token) return;
    setQuickAction("clearHistory", "loading");
    try { await api.clearAllHistory?.(token); setQuickAction("clearHistory", "success"); }
    catch { setQuickAction("clearHistory", "error"); }
  }

  async function handleSyncCommands() {
    if (!token) return;
    setQuickAction("syncCommands", "loading");
    try { await api.syncCommands?.(token); setQuickAction("syncCommands", "success"); }
    catch { setQuickAction("syncCommands", "error"); }
  }

  async function handleRestartBot() {
    if (!token) return;
    setQuickAction("restartBot", "loading");
    try {
      await api.restartBot?.(token);
      setQuickAction("restartBot", "success");
      setTimeout(() => fetchData(true), 5000);
    } catch { setQuickAction("restartBot", "error"); }
  }

  const primaryProvider = providersData?.providers.find((p: ProviderItem) => p.is_primary);
  const totalMembers = botStatus?.guilds?.reduce((sum, g) => sum + (g.member_count ?? 0), 0) ?? 0;

  const latencyColor =
    botStatus?.latency_ms == null ? "text-muted-foreground"
    : botStatus.latency_ms < 100 ? "text-green-600"
    : botStatus.latency_ms < 250 ? "text-yellow-500"
    : "text-red-500";

  const guilds = botStatus?.guilds ?? [];
  const visibleGuilds = showAllGuilds ? guilds : guilds.slice(0, GUILDS_PREVIEW_COUNT);
  const hasMoreGuilds = guilds.length > GUILDS_PREVIEW_COUNT;

  function providerHealth(prov: ProviderItem): "healthy" | "degraded" | "down" | "unconfigured" {
    if (!prov.configured) return "unconfigured";
    if (prov.is_primary && botStatus?.online) return "healthy";
    if (prov.configured) return "healthy";
    return "down";
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 bg-muted rounded animate-pulse" />
          <div className="h-8 w-24 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(2)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-3 text-center min-h-[200px]">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-red-500 font-medium">{error}</p>
        <button onClick={() => fetchData(false)} className="flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-xs hover:bg-muted transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {showInstallModal && <InstallModal onClose={() => setShowInstallModal(false)} />}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Overview</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Monitor your bot's status and connected servers</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground hidden sm:block">Updated {lastUpdated.toLocaleTimeString()}</span>
            )}
            <button onClick={() => fetchData(true)} disabled={refreshing} className="flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50 transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
            </button>
            <button onClick={() => setShowInstallModal(true)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add to Server
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

        {/* Install nudge banner */}
        {botStatus?.online && guilds.length === 0 && (
          <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-800 px-4 py-3">
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-indigo-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">Your bot isn't in any servers yet</p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400">Add SparkSage to a Discord server to get started</p>
              </div>
            </div>
            <button onClick={() => setShowInstallModal(true)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-2 text-xs font-medium transition-colors flex-shrink-0">
              Add to Server <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Stats Cards — 5 cards including Total Members */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Bot Status</CardTitle>
              {botStatus?.online ? <Wifi className="h-4 w-4 text-green-600" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
            </CardHeader>
            <CardContent>
              <Badge variant={botStatus?.online ? "default" : "secondary"}>{botStatus?.online ? "Online" : "Offline"}</Badge>
              {botStatus?.username && <p className="text-xs text-muted-foreground mt-1">{botStatus.username}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Latency</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${latencyColor}`}>{botStatus?.latency_ms != null ? `${Math.round(botStatus.latency_ms)}ms` : "--"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {botStatus?.latency_ms == null ? "--" : botStatus.latency_ms < 100 ? "Excellent" : botStatus.latency_ms < 250 ? "Good" : "High"}
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
              <button onClick={() => setShowInstallModal(true)} className="text-xs text-indigo-500 hover:underline mt-1 flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add server
              </button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totalMembers > 0 ? totalMembers.toLocaleString() : "--"}</p>
              <p className="text-xs text-muted-foreground mt-1">Across all servers</p>
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

        {/* Quick Actions + Recent Activity */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <QuickActionButton
                icon={RotateCcw}
                label="Sync Commands"
                description="Re-sync slash commands with Discord"
                state={quickActions.syncCommands}
                onClick={handleSyncCommands}
              />
              <QuickActionButton
                icon={Trash2}
                label="Clear All History"
                description="Wipe conversation memory across all channels"
                state={quickActions.clearHistory}
                variant="danger"
                onClick={handleClearHistory}
              />
              <QuickActionButton
                icon={Zap}
                label="Restart Bot"
                description="Gracefully restart the Discord bot process"
                state={quickActions.restartBot}
                variant="danger"
                onClick={handleRestartBot}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                  <Clock className="h-6 w-6 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                  <p className="text-xs text-muted-foreground/60">Commands will appear here as they're used</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {activity.slice(0, 8).map((entry, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                          /{entry.command}
                        </code>
                        <span className="text-xs text-muted-foreground truncate">
                          by <span className="font-medium text-foreground">{entry.user}</span>
                          {entry.guild && <> in {entry.guild}</>}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(entry.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Connected Servers */}
        {guilds.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Connected Servers</CardTitle>
              <button onClick={() => setShowInstallModal(true)} className="text-xs text-indigo-500 hover:underline flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add server
              </button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {visibleGuilds.map((guild) => <GuildRow key={guild.id} guild={guild} />)}
              </div>
              {hasMoreGuilds && (
                <button onClick={() => setShowAllGuilds((v) => !v)} className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {showAllGuilds
                    ? <><ChevronUp className="h-3.5 w-3.5" /> Show less</>
                    : <><ChevronDown className="h-3.5 w-3.5" /> Show {guilds.length - GUILDS_PREVIEW_COUNT} more</>}
                </button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Provider Health */}
        {providersData?.fallback_order?.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Provider Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {providersData.fallback_order.map((name, i) => {
                  const prov = providersData.providers.find((p) => p.name === name);
                  const health = prov ? providerHealth(prov) : "unconfigured";
                  const healthLabel = { healthy: "Healthy", degraded: "Degraded", down: "Down", unconfigured: "Not configured" }[health];
                  const healthText = { healthy: "text-green-600", degraded: "text-yellow-600", down: "text-red-500", unconfigured: "text-muted-foreground" }[health];

                  return (
                    <div key={name} className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <HealthDot status={health} />
                        <div>
                          <p className="text-sm font-medium">{prov?.display_name || name}</p>
                          <p className="text-xs text-muted-foreground">{prov?.model || "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {prov?.is_primary && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                        {i > 0 && <Badge variant="outline" className="text-xs">Fallback {i}</Badge>}
                        <span className={`text-xs font-medium ${healthText}`}>{healthLabel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Chain:</span>
                {providersData.fallback_order.map((name, i) => {
                  const prov = providersData.providers.find((p) => p.name === name);
                  return (
                    <div key={name} className="flex items-center gap-1.5">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">{prov?.display_name || name}</span>
                      {i < providersData.fallback_order.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
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