"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Eye, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface OnboardingSettings {
  enabled: boolean;
  channel_id: string | null;
  template: string;
  use_ai: boolean;
}

export default function OnboardingPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string })?.accessToken;
  
  const [settings, setSettings] = useState<OnboardingSettings>({
    enabled: false,
    channel_id: null,
    template: "",
    use_ai: true
  });
  const [guilds, setGuilds] = useState<{ id: string; name: string }[]>([]);
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

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
        setChannels(data);
      })
      .catch(() => toast.error("Failed to load channels"));
  }, [token, selectedGuild, API]);

  // Fetch settings when guild changes
  useEffect(() => {
    if (!token || !selectedGuild) return;
    
    setLoading(true);
    fetch(`${API}/api/onboarding/${selectedGuild}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setSettings({
          enabled: data.enabled ?? false,
          channel_id: data.channel_id ?? null,
          template: data.template ?? "",
          use_ai: data.use_ai ?? true
        });
      })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, [token, selectedGuild, API]);

  const handleSave = async () => {
    if (!token || !selectedGuild) return;
    
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/onboarding/${selectedGuild}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      
      if (!res.ok) throw new Error("Failed to save");
      
      toast.success("Onboarding settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!token || !selectedGuild) return;
    
    try {
      const res = await fetch(`${API}/api/onboarding/${selectedGuild}/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      
      const data = await res.json();
      setPreview(data.preview);
    } catch {
      toast.error("Failed to generate preview");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Member Onboarding</h1>
          <p className="text-sm text-muted-foreground">
            Welcome new members with automated messages
          </p>
        </div>
      </div>

      {/* Guild selector */}
      <Card>
        <CardContent className="pt-6">
          <Label htmlFor="guild-select">Select Server</Label>
          <select
            id="guild-select"
            value={selectedGuild}
            onChange={(e) => setSelectedGuild(e.target.value)}
            className="w-full md:w-96 mt-1 px-3 py-2 border rounded-md bg-background"
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

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Settings card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Onboarding Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Enable checkbox - FIXED with null coalescing */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="enable-onboarding"
                  checked={settings.enabled ?? false}
                  onChange={(e) => setSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="h-4 w-4 mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="space-y-1">
                  <Label htmlFor="enable-onboarding" className="font-medium">Enable Onboarding</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically welcome new members when they join
                  </p>
                </div>
              </div>

              {/* Channel selection - FIXED with null coalescing */}
              <div className="space-y-2 pt-2">
                <Label htmlFor="channel-select">Welcome Channel</Label>
                <select
                  id="channel-select"
                  value={settings.channel_id ?? ""}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    channel_id: e.target.value || null 
                  }))}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  disabled={!settings.enabled}
                >
                  <option value="">Direct Message (DM)</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      #{channel.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Leave empty to send as DM
                </p>
              </div>

              {/* Message mode selection */}
              <div className="space-y-2">
                <Label htmlFor="mode-select">Message Mode</Label>
                <select
                  id="mode-select"
                  value={settings.use_ai ? "ai" : "template"}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    use_ai: e.target.value === "ai" 
                  }))}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  disabled={!settings.enabled}
                >
                  <option value="ai">AI-Generated (dynamic, unique each time)</option>
                  <option value="template">Custom Template (fixed message)</option>
                </select>
              </div>

              {/* Template textarea */}
              {!settings.use_ai && (
                <div className="space-y-2">
                  <Label htmlFor="template">Welcome Message Template</Label>
                  <Textarea
                    id="template"
                    value={settings.template ?? ""}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      template: e.target.value 
                    }))}
                    placeholder="Welcome {user} to {server}! 🎉"
                    rows={4}
                    disabled={!settings.enabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    Available placeholders: {'{user}'}, {'{server}'}, {'{mention}'}, {'{count}'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                variant="outline" 
                onClick={handlePreview}
                disabled={!settings.enabled}
              >
                <Eye className="h-4 w-4 mr-2" />
                Generate Preview
              </Button>
              
              {preview && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="whitespace-pre-wrap">{preview}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save button */}
          <div className="flex justify-end">
            <Button 
              onClick={handleSave} 
              disabled={saving || !settings.enabled}
              size="lg"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>
        </>
      )}
    </div>
  );
}