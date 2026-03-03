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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Pencil, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface ChannelPrompt {
  channel_id: string;
  system_prompt: string;
  channel_name?: string;
}

interface GuildChannel {
  id: string;
  name: string;
  type: number;
}

export default function ChannelPromptsPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string })?.accessToken;
  
  const [prompts, setPrompts] = useState<ChannelPrompt[]>([]);
  const [channels, setChannels] = useState<GuildChannel[]>([]);
  const [guilds, setGuilds] = useState<{ id: string; name: string }[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<ChannelPrompt | null>(null);
  const [formData, setFormData] = useState({
    channel_id: "",
    system_prompt: ""
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

  // Fetch prompts when guild changes
  useEffect(() => {
    if (!token || !selectedGuild) return;
    
    setLoading(true);
    fetch(`${API}/api/channel-prompts/guild/${selectedGuild}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        // Merge with channel names
        const enriched = data.map((p: ChannelPrompt) => ({
          ...p,
          channel_name: channels.find(c => c.id === p.channel_id)?.name || p.channel_id
        }));
        setPrompts(enriched);
      })
      .catch(() => toast.error("Failed to load prompts"))
      .finally(() => setLoading(false));
  }, [token, selectedGuild, API, channels]);

  const handleSave = async () => {
    if (!token || !selectedGuild || !formData.channel_id || !formData.system_prompt) {
      toast.error("Please fill all fields");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API}/api/channel-prompts/channel/${formData.channel_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          guild_id: selectedGuild,
          prompt: formData.system_prompt
        })
      });

      if (!res.ok) throw new Error("Failed to save");

      toast.success("Channel prompt saved");
      setDialogOpen(false);
      setFormData({ channel_id: "", system_prompt: "" });
      setEditingPrompt(null);
      
      // Refresh prompts
      const updated = await fetch(`${API}/api/channel-prompts/guild/${selectedGuild}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());
      
      const enriched = updated.map((p: ChannelPrompt) => ({
        ...p,
        channel_name: channels.find(c => c.id === p.channel_id)?.name || p.channel_id
      }));
      setPrompts(enriched);
    } catch (err) {
      toast.error("Failed to save prompt");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (channelId: string) => {
    if (!token) return;

    try {
      const res = await fetch(`${API}/api/channel-prompts/channel/${channelId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Failed to delete");

      toast.success("Prompt deleted");
      setPrompts(prev => prev.filter(p => p.channel_id !== channelId));
    } catch (err) {
      toast.error("Failed to delete prompt");
    }
  };

  const openEditDialog = (prompt?: ChannelPrompt) => {
    if (prompt) {
      setEditingPrompt(prompt);
      setFormData({
        channel_id: prompt.channel_id,
        system_prompt: prompt.system_prompt
      });
    } else {
      setEditingPrompt(null);
      setFormData({ channel_id: "", system_prompt: "" });
    }
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Channel Prompts</h1>
          <p className="text-sm text-muted-foreground">
            Set custom AI personalities for specific channels
          </p>
        </div>
        <Button onClick={() => openEditDialog()} disabled={!selectedGuild}>
          <Plus className="h-4 w-4 mr-2" />
          Add Prompt
        </Button>
      </div>

      {/* Guild selector - Native HTML Select */}
      <Card>
        <CardContent className="pt-6">
          <Label htmlFor="guild-select">Select Server</Label>
          <select
            id="guild-select"
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

      {/* Prompts list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : prompts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No custom prompts set for this server</p>
            <Button 
              variant="link" 
              onClick={() => openEditDialog()}
              className="mt-2"
            >
              Add your first prompt
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {prompts.map((prompt) => (
            <Card key={prompt.channel_id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">#{prompt.channel_name}</h3>
                      <span className="text-xs text-muted-foreground">
                        {prompt.channel_id}
                      </span>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm whitespace-pre-wrap">{prompt.system_prompt}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(prompt)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(prompt.channel_id)}
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

      {/* Add/Edit Dialog - Native HTML Select */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPrompt ? "Edit Channel Prompt" : "Add Channel Prompt"}
            </DialogTitle>
            <DialogDescription>
              Set a custom system prompt for a specific channel. This will override the global prompt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="channel-select">Select Channel</Label>
              <select
                id="channel-select"
                value={formData.channel_id}
                onChange={(e) => setFormData(prev => ({ ...prev, channel_id: e.target.value }))}
                disabled={!!editingPrompt}
                className={`w-full px-3 py-2 border rounded-md bg-background ${
                  editingPrompt ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <option value="" disabled>Choose a channel</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </select>
              {editingPrompt && (
                <p className="text-xs text-muted-foreground">
                  Channel cannot be changed when editing
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">System Prompt</Label>
              <Textarea
                id="prompt"
                rows={6}
                value={formData.system_prompt}
                onChange={(e) => setFormData(prev => ({ ...prev, system_prompt: e.target.value }))}
                placeholder="You are a helpful assistant in this channel..."
              />
              <p className="text-xs text-muted-foreground">
                This prompt will be used for all AI responses in this channel.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingPrompt ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}