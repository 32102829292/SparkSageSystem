"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Plugin {
  name: string;
  version: string;
  author: string;
  description: string;
  cog: string;
  enabled: boolean;
}

export default function PluginsPage() {
  const { data: session, status } = useSession();
  const token = (session as { accessToken?: string })?.accessToken;

  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchPlugins = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API}/api/plugins`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch plugins");
      const data = await res.json();
      setPlugins(data);
    } catch {
      setError("Unable to load plugins.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "loading" || !token) return;
    fetchPlugins();
  }, [token, status]);

  const handleToggle = async (plugin: Plugin) => {
    const action = plugin.enabled ? "disable" : "enable";
    try {
      setToggling(plugin.name);
      const res = await fetch(`${API}/api/plugins/${plugin.name}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to toggle plugin");
      setPlugins((prev) =>
        prev.map((p) => (p.name === plugin.name ? { ...p, enabled: !p.enabled } : p))
      );
    } catch {
      setError(`Failed to ${action} plugin.`);
    } finally {
      setToggling(null);
    }
  };

  const enabled = plugins.filter((p) => p.enabled);
  const disabled = plugins.filter((p) => !p.enabled);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Plugins</h1>
        <span className="text-sm text-muted-foreground">
          {enabled.length} active / {plugins.length} total
        </span>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading plugins...</p>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-red-500">{error}</CardContent>
        </Card>
      ) : plugins.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No plugins found. Add plugin files to the <span className="font-mono">plugins/</span> directory.
          </CardContent>
        </Card>
      ) : (
        <>
          {enabled.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Active</h2>
              {enabled.map((plugin) => (
                <PluginCard key={plugin.name} plugin={plugin} toggling={toggling} onToggle={handleToggle} />
              ))}
            </div>
          )}
          {disabled.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Inactive</h2>
              {disabled.map((plugin) => (
                <PluginCard key={plugin.name} plugin={plugin} toggling={toggling} onToggle={handleToggle} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PluginCard({
  plugin,
  toggling,
  onToggle,
}: {
  plugin: Plugin;
  toggling: string | null;
  onToggle: (p: Plugin) => void;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">{plugin.name}</p>
              <span className="text-xs text-muted-foreground">v{plugin.version}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  plugin.enabled
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {plugin.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{plugin.description}</p>
            <p className="text-xs text-muted-foreground">
              by {plugin.author} · <span className="font-mono">{plugin.cog}</span>
            </p>
          </div>
          <button
            onClick={() => onToggle(plugin)}
            disabled={toggling === plugin.name}
            className={`text-xs rounded-lg px-3 py-1.5 disabled:opacity-50 ${
              plugin.enabled
                ? "border border-gray-300 hover:bg-gray-50"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            {toggling === plugin.name
              ? "..."
              : plugin.enabled
              ? "Disable"
              : "Enable"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}