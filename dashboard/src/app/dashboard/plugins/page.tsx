"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "../../../components/ui/card";
import { Plus, X, Upload, FileCode, AlertCircle, CheckCircle2 } from "lucide-react";

interface Plugin {
  name: string;
  version: string;
  author: string;
  description: string;
  cog: string;
  enabled: boolean;
}

type UploadState = "idle" | "uploading" | "success" | "error";

export default function PluginsPage() {
  const { data: session, status } = useSession();
  const token = (session as { accessToken?: string })?.accessToken;

  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

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

  const handlePluginAdded = () => {
    setShowAddModal(false);
    fetchPlugins();
  };

  const enabled = plugins.filter((p) => p.enabled);
  const disabled = plugins.filter((p) => !p.enabled);

  return (
    <>
      {showAddModal && (
        <AddPluginModal
          token={token!}
          api={API}
          onClose={() => setShowAddModal(false)}
          onSuccess={handlePluginAdded}
        />
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Plugins</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {enabled.length} active / {plugins.length} total
            </span>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Plugin
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-64 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="h-8 w-16 bg-muted rounded animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center text-red-500">{error}</CardContent>
          </Card>
        ) : plugins.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <FileCode className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p className="text-muted-foreground">No plugins found.</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors mx-auto"
              >
                <Plus className="h-4 w-4" /> Add your first plugin
              </button>
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
    </>
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
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
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
            className={`text-xs rounded-lg px-3 py-1.5 disabled:opacity-50 transition-colors ${
              plugin.enabled
                ? "border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            {toggling === plugin.name ? "..." : plugin.enabled ? "Disable" : "Enable"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function AddPluginModal({
  token,
  api,
  onClose,
  onSuccess,
}: {
  token: string;
  api: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [tab, setTab] = useState<"paste" | "upload">("paste");
  const [code, setCode] = useState("");
  const [filename, setFilename] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".py")) {
      setErrorMsg("Only .py files are supported.");
      return;
    }
    setFilename(file.name.replace(".py", ""));
    const reader = new FileReader();
    reader.onload = (ev) => setCode(ev.target?.result as string);
    reader.readAsText(file);
    setErrorMsg(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".py")) {
      setErrorMsg("Only .py files are supported.");
      return;
    }
    setFilename(file.name.replace(".py", ""));
    const reader = new FileReader();
    reader.onload = (ev) => setCode(ev.target?.result as string);
    reader.readAsText(file);
    setErrorMsg(null);
  };

  // Extract plugin name from code if not set
  const derivedName = filename || (() => {
    const match = code.match(/["']name["']\s*:\s*["']([^"']+)["']/);
    return match ? match[1] : "";
  })();

  const handleSubmit = async () => {
    if (!code.trim()) {
      setErrorMsg("Please provide plugin code.");
      return;
    }
    if (!derivedName) {
      setErrorMsg("Could not determine plugin name. Set a filename or include 'name' in PLUGIN_INFO.");
      return;
    }
    setUploadState("uploading");
    setErrorMsg(null);
    try {
      const res = await fetch(`${api}/api/plugins/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: derivedName, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || `Error ${res.status}`);
      setUploadState("success");
      setTimeout(onSuccess, 1200);
    } catch (err: unknown) {
      setUploadState("error");
      setErrorMsg(err instanceof Error ? err.message : "Upload failed.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border rounded-xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-indigo-500" />
            <h2 className="font-semibold text-lg">Add Plugin</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {(["paste", "upload"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === t
                  ? "border-b-2 border-indigo-500 text-indigo-600"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "paste" ? "Paste Code" : "Upload File"}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">
          {/* Plugin name */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Plugin filename (without .py)</label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value.replace(/[^a-z0-9_]/gi, "_").toLowerCase())}
              placeholder="e.g. my_plugin"
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Will be saved as <span className="font-mono">plugins/{filename || "plugin_name"}.py</span>
            </p>
          </div>

          {tab === "paste" ? (
            <div>
              <label className="text-sm font-medium block mb-1.5">Plugin code</label>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={`PLUGIN_INFO = {\n    "name": "my_plugin",\n    "version": "1.0.0",\n    "author": "You",\n    "description": "What this plugin does",\n    "cog": "MyCog",\n}\n\nfrom discord.ext import commands\n\nclass MyCog(commands.Cog):\n    ...\n\nasync def setup(bot):\n    await bot.add_cog(MyCog(bot))`}
                rows={14}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors"
            >
              <input ref={fileRef} type="file" accept=".py" className="hidden" onChange={handleFileChange} />
              <Upload className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              {code ? (
                <p className="text-sm font-medium text-green-600">
                  ✓ {filename}.py loaded ({code.split("\n").length} lines)
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium">Drop your .py file here</p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                </>
              )}
            </div>
          )}

          {/* Error */}
          {errorMsg && (
            <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* Info box */}
          <div className="bg-muted/50 rounded-lg px-3 py-2.5 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Plugin requirements</p>
            <p>• Must include a <span className="font-mono">PLUGIN_INFO</span> dict with name, version, author, description, cog</p>
            <p>• Must have an <span className="font-mono">async def setup(bot)</span> function</p>
            <p>• Will be auto-enabled after upload</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 border rounded-lg px-4 py-2 text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={uploadState === "uploading" || uploadState === "success" || !code.trim()}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              {uploadState === "uploading" ? (
                <>Uploading…</>
              ) : uploadState === "success" ? (
                <><CheckCircle2 className="h-4 w-4" /> Uploaded!</>
              ) : (
                <><Upload className="h-4 w-4" /> Upload Plugin</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}