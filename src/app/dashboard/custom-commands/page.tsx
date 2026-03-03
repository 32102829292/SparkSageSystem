"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CustomCommand {
  id: number;
  name: string;
  response: string;
  description: string;
  enabled: number;
  times_used: number;
  created_at: string;
}

export default function CustomCommandsPage() {
  const { data: session, status } = useSession();
  const token = (session as { accessToken?: string })?.accessToken;

  const [commands, setCommands] = useState<CustomCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);
  const [editing, setEditing] = useState<CustomCommand | null>(null);

  const [form, setForm] = useState({ name: "", response: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchCommands = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API}/api/custom-commands`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      setCommands(await res.json());
    } catch {
      setError("Unable to load custom commands.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "loading" || !token) return;
    fetchCommands();
  }, [token, status]);

  const handleAdd = async () => {
    if (!form.name || !form.response) {
      setFormError("Name and response are required.");
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      const res = await fetch(`${API}/api/custom-commands`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, description: form.description || "A custom command" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed");
      }
      setForm({ name: "", response: "", description: "" });
      setFormSuccess(true);
      setTimeout(() => setFormSuccess(false), 3000);
      await fetchCommands();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Failed to save command.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    try {
      setSaving(true);
      await fetch(`${API}/api/custom-commands/${editing.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ response: editing.response, description: editing.description }),
      });
      setEditing(null);
      await fetchCommands();
    } catch {
      setFormError("Failed to update command.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (cmd: CustomCommand) => {
    try {
      setToggling(cmd.id);
      await fetch(`${API}/api/custom-commands/${cmd.id}/toggle?enabled=${cmd.enabled ? 0 : 1}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchCommands();
    } catch {
      setError("Failed to toggle command.");
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      setDeleting(id);
      await fetch(`${API}/api/custom-commands/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setCommands((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError("Failed to delete command.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Custom Commands</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Trigger in Discord using{" "}
            <span className="font-mono bg-muted px-1 rounded">!commandname</span>
          </p>
        </div>
        <span className="text-sm text-muted-foreground">{commands.length} commands</span>
      </div>

      <Card className="border-indigo-200 bg-indigo-50 dark:bg-indigo-950 dark:border-indigo-800">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm font-medium text-indigo-800 dark:text-indigo-200">How it works</p>
          <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">
            Create a command below, then type{" "}
            <span className="font-mono font-bold">!name</span> in any Discord channel and the bot will reply instantly. Example:{" "}
            <span className="font-mono font-bold">!rules</span> → bot replies with your rules text.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Create New Command</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 items-center">
            <span className="text-sm font-mono font-bold bg-muted px-2 py-2 rounded-lg">!</span>
            <input
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Command name (e.g. rules, info, links)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/\s/g, "") })}
            />
          </div>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Short description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Response text — what the bot will say when this command is used"
            rows={3}
            value={form.response}
            onChange={(e) => setForm({ ...form, response: e.target.value })}
          />
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          {formSuccess && (
            <p className="text-sm text-green-500">
              Command created! Use <span className="font-mono">!{form.name || "commandname"}</span> in Discord.
            </p>
          )}
          <button
            onClick={handleAdd}
            disabled={saving}
            className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create Command"}
          </button>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-muted-foreground">Loading commands...</p>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-red-500">{error}</CardContent>
        </Card>
      ) : commands.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No custom commands yet. Create one above.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {commands.map((cmd) => (
            <Card key={cmd.id} className={cmd.enabled ? "" : "opacity-60"}>
              <CardContent className="pt-4">
                {editing?.id === cmd.id ? (
                  <div className="space-y-2">
                    <p className="text-sm font-mono font-medium">!{cmd.name}</p>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={editing.description}
                      onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    />
                    <textarea
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      rows={3}
                      value={editing.response}
                      onChange={(e) => setEditing({ ...editing, response: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        disabled={saving}
                        className="bg-indigo-600 text-white rounded-lg px-3 py-1.5 text-xs hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="border rounded-lg px-3 py-1.5 text-xs hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-medium text-sm">!{cmd.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${cmd.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {cmd.enabled ? "Active" : "Disabled"}
                        </span>
                        <span className="text-xs text-muted-foreground">used {cmd.times_used}x</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{cmd.description}</p>
                      <p className="text-sm">{cmd.response}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setEditing(cmd)}
                        className="text-xs border rounded-lg px-2 py-1 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggle(cmd)}
                        disabled={toggling === cmd.id}
                        className="text-xs border rounded-lg px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {toggling === cmd.id ? "..." : cmd.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => handleDelete(cmd.id)}
                        disabled={deleting === cmd.id}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        {deleting === cmd.id ? "..." : "Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}