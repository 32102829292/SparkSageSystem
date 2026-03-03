"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, RefreshCw, Clock, Users, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface RateLimitData {
  used: number;
  remaining: number;
  limit: number;
  reset_in: number;
  percentage: number;
  status: string;
  color: string;
}

interface Settings {
  user_limit: number;
  guild_limit: number;
  window_minutes: number;
}

export default function RateLimitsPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string })?.accessToken;
  
  const [data, setData] = useState<{ guild: RateLimitData; settings: Settings } | null>(null);
  const [guilds, setGuilds] = useState<{ id: string; name: string }[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

  useEffect(() => {
    if (!token || !selectedGuild) return;
    
    setLoading(true);
    fetch(`${API}/api/rate-limits/dashboard?guild_id=${selectedGuild}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setData)
      .catch(() => toast.error("Failed to load rate limit data"))
      .finally(() => setLoading(false));
  }, [token, selectedGuild, API]);

  const getStatusColor = (color: string) => {
    const colors = {
      green: "text-green-500",
      yellow: "text-yellow-500",
      red: "text-red-500"
    };
    return colors[color as keyof typeof colors] || "text-gray-500";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rate Limits</h1>
          <p className="text-sm text-muted-foreground">
            Monitor and manage API rate limits
          </p>
        </div>
      </div>

      {/* Guild selector */}
      <Card>
        <CardContent className="pt-6">
          <label className="text-sm font-medium">Select Server</label>
          <select
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
      ) : data ? (
        <>
          {/* Guild rate limit card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Server Rate Limit
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {data.guild.used} / {data.guild.limit} requests
                </span>
                <span className={`text-sm font-medium ${getStatusColor(data.guild.color)}`}>
                  {data.guild.status}
                </span>
              </div>
              <Progress value={data.guild.percentage} />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Resets in {data.guild.reset_in} seconds</span>
              </div>
            </CardContent>
          </Card>

          {/* Settings card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Rate Limit Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Per User</p>
                  <p className="text-2xl font-bold">{data.settings.user_limit}/min</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Per Server</p>
                  <p className="text-2xl font-bold">{data.settings.guild_limit}/min</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Window</p>
                  <p className="text-2xl font-bold">{data.settings.window_minutes} min</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}