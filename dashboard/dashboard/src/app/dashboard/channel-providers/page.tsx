"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Pencil, Trash2, Cpu } from "lucide-react";
import { toast } from "sonner";

interface ChannelOverride {
  channel_id: string;
  provider: string;
  channel_name?: string;
}

interface GuildChannel {
  id: string;
  name: string;
  type: number;
}

export default function ChannelProvidersPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string })?.accessToken;
  
  const [overrides, setOverrides] = useState<ChannelOverride[]>([]);
  const [channels, setChannels] = useState<GuildChannel[]>([]);
  const [guilds, setGuilds] = useState<{ id: string; name: string }[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOverride, setEditingOverride] = useState<ChannelOverride | null>(null);
  const [formData, setFormData] = useState({
    channel_id: "",
    provider: ""
  });

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Fetch guilds on mount
  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/bot/guilds`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setGuilds(data.guilds || []);
        if (data.guilds?.length > 0) {
          setSelectedGuild(data.guilds[0].id);
        }
      })
      .catch(() => toast.error("Failed to load guilds"));
  }, [token, API]);

  // Fetch available providers
  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/channel-providers/providers/list`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setProviders(data || []);
      })
      .catch(() => toast.error("Failed to load providers"));
  }, [token, API]);

  // Fetch channels when guild changes
  useEffect(() => {
    if (!token || !selectedGuild) return;
    
    fetch(`${API}/api/bot/guilds/${selectedGuild}/channels`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        // Filter to text channels only
        const textChannels = data.filter((c: GuildChannel) => c.type === 0);
        setChannels(textChannels);
      })
      .catch(() => toast.error("Failed to load channels"));
  }, [token, selectedGuild, API]);

  // Fetch overrides when guild changes
  useEffect(() => {
    if (!token || !selectedGuild) return;
    
    setLoading(true);
    fetch(`${API}/api/channel-providers/guild/${selectedGuild}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then(data => {
        const dataArray = Array.isArray(data) ? data : [];
        // Merge with channel names
        const enriched = dataArray.map((item: ChannelOverride) => ({
          ...item,
          channel_name: channels.find(c => c.id === item.channel_id)?.name || item.channel_id
        }));
        setOverrides(enriched);
      })
      .catch(err => {
        console.error(err);
        toast.error("Failed to load provider overrides");
        setOverrides([]);
      })
      .finally(() => setLoading(false));
  }, [token, selectedGuild, API, channels]);

  const handleSave = async () => {
    if (!token || !selectedGuild || !formData.channel_id || !formData.provider) {
      toast.error("Please fill all fields");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `${API}/api/channel-providers/channel/${formData.channel_id}?guild_id=${selectedGuild}&provider=${formData.provider}`, 
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to save");
      }

      toast.success("Channel provider saved");
      setDialogOpen(false);
      setFormData({ channel_id: "", provider: "" });
      setEditingOverride(null);
      
      // Refresh overrides
      const updated = await fetch(`${API}/api/channel-providers/guild/${selectedGuild}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());
      
      const enriched = updated.map((item: ChannelOverride) => ({
        ...item,
        channel_name: channels.find(c => c.id === item.channel_id)?.name || item.channel_id
      }));
      setOverrides(enriched);
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (channelId: string) => {
    if (!token) return;

    try {
      const res = await fetch(`${API}/api/channel-providers/channel/${channelId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Failed to delete");

      toast.success("Provider override deleted");
      setOverrides(prev => prev.filter(o => o.channel_id !== channelId));
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const openEditDialog = (override?: ChannelOverride) => {
    if (override) {
      setEditingOverride(override);
      setFormData({
        channel_id: override.channel_id,
        provider: override.provider
      });
    } else {
      setEditingOverride(null);
      setFormData({ channel_id: "", provider: "" });
    }
    setDialogOpen(true);
  };

  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      gemini: "text-blue-500",
      groq: "text-orange-500",
      openrouter: "text-purple-500",
      anthropic: "text-emerald-500",
      openai: "text-green-500"
    };
    return colors[provider] || "text-gray-500";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Channel Providers</h1>
          <p className="text-sm text-muted-foreground">
            Override AI providers for specific channels
          </p>
        </div>
        <Button onClick={() => openEditDialog()} disabled={!selectedGuild}>
          <Plus className="h-4 w-4 mr-2" />
          Add Override
        </Button>
      </div>

      {/* Guild selector */}
      <Card>
        <CardContent className="pt-6">
          <Label>Select Server</Label>
          <select
            value={selectedGuild}
            onChange={(e) => setSelectedGuild(e.target.value)}
            className="w-full md:w-96 px-3 py-2 border rounded-md bg-background"
          >
            <option value="" disabled>Choose a server</option>
            {guilds.map((guild) => (
              <option key={guild.id} value={guild.id}>
                {guild.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Overrides list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : overrides.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Cpu className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No provider overrides set for this server</p>
            <Button 
              variant="link" 
              onClick={() => openEditDialog()}
              className="mt-2"
            >
              Add your first override
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {overrides.map((override) => (
            <Card key={override.channel_id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">#{override.channel_name}</h3>
                      <span className="text-xs text-muted-foreground">
                        {override.channel_id.slice(0, 8)}...
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Cpu className={`h-4 w-4 ${getProviderColor(override.provider)}`} />
                      <span className="text-sm font-medium">{override.provider}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(override)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(override.channel_id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingOverride ? "Edit Provider Override" : "Add Provider Override"}
            </DialogTitle>
            <DialogDescription>
              Set a specific AI provider for this channel. This will override the global provider.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Channel</Label>
              <select
                value={formData.channel_id}
                onChange={(e) => setFormData(prev => ({ ...prev, channel_id: e.target.value }))}
                disabled={!!editingOverride}
                className={`w-full px-3 py-2 border rounded-md bg-background ${
                  editingOverride ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <option value="" disabled>Choose a channel</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </select>
              {editingOverride && (
                <p className="text-xs text-muted-foreground">
                  Channel cannot be changed when editing
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Select Provider</Label>
              <select
                value={formData.provider}
                onChange={(e) => setFormData(prev => ({ ...prev, provider: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="" disabled>Choose a provider</option>
                {providers.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider.charAt(0).toUpperCase() + provider.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingOverride ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}