"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Sensitivity = "low" | "medium" | "high";

interface ModerationConfig {
  enabled: boolean;
  channel_id: string;
  sensitivity: Sensitivity;
}

interface ModerationStats {
  total_flagged: number;
  by_severity: { low: number; medium: number; high: number };
}

export default function ModerationPage() {
  const { data: session, status } = useSession();
  const token = (session as { accessToken?: string })?.accessToken;

  const [config, setConfig] = useState<ModerationConfig>({
    enabled: false,
    channel_id: "",
    sensitivity: "medium",
  });
  const [stats, setStats] = useState<ModerationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading" || !token) return;
    Promise.all([
      fetch(`${API}/api/moderation`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`${API}/api/moderation/stats`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([cfg, st]) => {
        setConfig(cfg);
        setStats(st);
      })
      .catch(() => setError("Failed to load moderation settings."))
      .finally(() => setLoading(false));
  }, [token, status]);

  const handleSave = async () => {
    if (!token) return;
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`${API}/api/moderation`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const sensitivityOptions: { value: Sensitivity; label: string; desc: string }[] = [
    { value: "low", label: "Low", desc: "Only serious violations (hate speech, threats)" },
    { value: "medium", label: "Medium", desc: "Balanced — recommended for most servers" },
    { value: "high", label: "High", desc: "Flag anything borderline or rude" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold">Content Moderation</h1>
          <p className="text-sm text-muted-foreground">
            AI-powered message flagging for human moderator review
          </p>
        </div>
      </div>

      {/* Warning banner */}
      <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">⚠️ Important</p>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
            SparkSage flags messages for human review only. It never auto-deletes or auto-bans. A moderator must always review and take action.
          </p>
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Flagged</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.total_flagged}</p>
            </CardContent>
          </Card>
          {(["low", "medium", "high"] as Sensitivity[]).map((sev) => (
            <Card key={sev}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium capitalize">{sev} Severity</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${sev === "high" ? "text-red-500" : sev === "medium" ? "text-orange-500" : "text-yellow-500"}`}>
                  {stats.by_severity?.[sev] ?? 0}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading settings...</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Moderation Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Enable toggle */}
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Enable Moderation</p>
                <p className="text-xs text-muted-foreground">Scan messages in real time</p>
              </div>
              <button
                onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  config.enabled ? "bg-indigo-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    config.enabled ? "translate-x-4" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Channel ID */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mod Log Channel ID</label>
              <p className="text-xs text-muted-foreground">
                Right-click a channel in Discord → Copy Channel ID (requires Developer Mode)
              </p>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. 1234567890123456789"
                value={config.channel_id ?? ""}
                onChange={(e) => setConfig({ ...config, channel_id: e.target.value.trim() })}
              />
            </div>

            {/* Sensitivity */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Sensitivity Level</label>
              <div className="space-y-2">
                {sensitivityOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setConfig({ ...config, sensitivity: opt.value })}
                    className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
                      config.sensitivity === opt.value
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
                        : "hover:bg-muted"
                    }`}
                  >
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Discord commands */}
            <div className="rounded-lg border bg-muted/50 px-4 py-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Discord Commands</p>
              <div className="space-y-1">
                {[
                  ["/mod setup", "Set channel and sensitivity via Discord"],
                  ["/mod disable", "Disable moderation"],
                  ["/mod status", "Check current config"],
                  ["/mod sensitivity", "Change sensitivity level"],
                ].map(([cmd, desc]) => (
                  <div key={cmd} className="flex gap-3 text-xs">
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 w-36 shrink-0">{cmd}</span>
                    <span className="text-muted-foreground">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            {success && <p className="text-sm text-green-500">Settings saved successfully!</p>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}