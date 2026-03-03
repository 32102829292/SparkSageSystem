"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function DigestPage() {
  const { data: session, status } = useSession();
  const token = (session as { accessToken?: string })?.accessToken;

  const [enabled, setEnabled] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading" || !token) return;
    fetch(`${API}/api/digest`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setEnabled(d.enabled);
        setChannelId(d.channel_id ?? "");
      })
      .catch(() => setError("Failed to load digest settings."))
      .finally(() => setLoading(false));
  }, [token, status]);

  const handleSave = async () => {
    if (!token) return;
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`${API}/api/digest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, channel_id: channelId }),
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Newspaper className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold">Daily Digest</h1>
          <p className="text-sm text-muted-foreground">
            Automatically summarize daily bot activity and post it to a Discord channel
          </p>
        </div>
      </div>

      <Card className="border-indigo-200 bg-indigo-50 dark:bg-indigo-950 dark:border-indigo-800">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm font-medium text-indigo-800 dark:text-indigo-200">How it works</p>
          <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">
            Every 24 hours, SparkSage collects all bot conversations from the past day, uses AI to summarize the key topics, and posts a formatted digest to your chosen channel. Use{" "}
            <span className="font-mono font-bold">/digest now</span> in Discord to trigger it immediately.
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-muted-foreground">Loading settings...</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Digest Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Enable Daily Digest</p>
                <p className="text-xs text-muted-foreground">Post a summary every 24 hours</p>
              </div>
              <button
                onClick={() => setEnabled(!enabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  enabled ? "bg-indigo-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    enabled ? "translate-x-4" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Discord Channel ID</label>
              <p className="text-xs text-muted-foreground">
                Right-click a channel in Discord → Copy Channel ID (enable Developer Mode first)
              </p>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. 1234567890123456789"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value.trim())}
              />
            </div>

            <div className="rounded-lg border bg-muted/50 px-4 py-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Discord Commands</p>
              <div className="space-y-1">
                {[
                  ["/digest setup", "Set channel and enable via Discord"],
                  ["/digest now", "Trigger a digest immediately"],
                  ["/digest disable", "Disable the digest"],
                  ["/digest status", "Check current configuration"],
                ].map(([cmd, desc]) => (
                  <div key={cmd} className="flex gap-3 text-xs">
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 w-32 shrink-0">{cmd}</span>
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