"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Permission {
  command_name: string;
  guild_id: string;
  role_id: string;
}

export default function PermissionsPage() {
  const { data: session, status } = useSession();
  const token = (session as { accessToken?: string })?.accessToken;

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ command_name: "", guild_id: "", role_id: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchPermissions = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API}/api/permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch permissions");
      const data = await res.json();
      setPermissions(data);
    } catch {
      setError("Unable to load permissions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "loading" || !token) return;
    fetchPermissions();
  }, [token, status]);

  const handleAdd = async () => {
    if (!form.command_name || !form.guild_id || !form.role_id) {
      setFormError("All fields are required.");
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      const res = await fetch(`${API}/api/permissions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to set permission");
      setForm({ command_name: "", guild_id: "", role_id: "" });
      setFormSuccess(true);
      setTimeout(() => setFormSuccess(false), 3000);
      await fetchPermissions();
    } catch {
      setFormError("Failed to save permission.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (p: Permission) => {
    const key = `${p.command_name}-${p.guild_id}-${p.role_id}`;
    try {
      setRemoving(key);
      await fetch(`${API}/api/permissions`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(p),
      });
      setPermissions((prev) =>
        prev.filter(
          (x) =>
            !(x.command_name === p.command_name &&
              x.guild_id === p.guild_id &&
              x.role_id === p.role_id)
        )
      );
    } catch {
      setError("Failed to remove permission.");
    } finally {
      setRemoving(null);
    }
  };

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    if (!acc[p.command_name]) acc[p.command_name] = [];
    acc[p.command_name].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Permissions</h1>
        <span className="text-sm text-muted-foreground">{permissions.length} rules</span>
      </div>

      {/* Add Permission Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Restrict a Command to a Role</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Command name (e.g. review, faq, summarize)"
            value={form.command_name}
            onChange={(e) => setForm({ ...form, command_name: e.target.value })}
          />
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Guild ID"
            value={form.guild_id}
            onChange={(e) => setForm({ ...form, guild_id: e.target.value })}
          />
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Role ID"
            value={form.role_id}
            onChange={(e) => setForm({ ...form, role_id: e.target.value })}
          />
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          {formSuccess && <p className="text-sm text-green-500">Permission saved!</p>}
          <button
            onClick={handleAdd}
            disabled={saving}
            className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add Restriction"}
          </button>
        </CardContent>
      </Card>

      {/* Permissions List */}
      {loading ? (
        <p className="text-muted-foreground">Loading permissions...</p>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-red-500">{error}</CardContent>
        </Card>
      ) : Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No restrictions set. All commands are available to everyone.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([command, rules]) => (
            <Card key={command}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono">/{command}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {rules.map((p) => {
                  const key = `${p.command_name}-${p.guild_id}-${p.role_id}`;
                  return (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <div className="flex gap-4 text-muted-foreground">
                        <span>Guild: <span className="font-mono text-foreground">{p.guild_id}</span></span>
                        <span>Role: <span className="font-mono text-foreground">{p.role_id}</span></span>
                      </div>
                      <button
                        onClick={() => handleRemove(p)}
                        disabled={removing === key}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        {removing === key ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}