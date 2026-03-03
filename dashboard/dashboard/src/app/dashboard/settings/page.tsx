"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Save, RotateCcw, Eye, EyeOff, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const settingsSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, "Discord token is required"),
  BOT_PREFIX: z.string().min(1, "Prefix is required").max(5, "Prefix too long"),
  MAX_TOKENS: z.number().min(128, "Minimum 128 tokens").max(4096, "Maximum 4096 tokens"),
  SYSTEM_PROMPT: z.string().min(1, "System prompt is required"),
  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

type SettingsForm = z.infer<typeof settingsSchema>;

const DEFAULTS: SettingsForm = {
  DISCORD_TOKEN: "",
  BOT_PREFIX: "!",
  MAX_TOKENS: 1024,
  SYSTEM_PROMPT:
    "You are SparkSage, a helpful and friendly AI assistant in a Discord server. Be concise, helpful, and engaging.",
  GEMINI_API_KEY: "",
  GROQ_API_KEY: "",
  OPENROUTER_API_KEY: "",
  ANTHROPIC_API_KEY: "",
  OPENAI_API_KEY: "",
};

const API_KEY_FIELDS = [
  { key: "GEMINI_API_KEY", label: "Gemini" },
  { key: "GROQ_API_KEY", label: "Groq" },
  { key: "OPENROUTER_API_KEY", label: "OpenRouter" },
  { key: "ANTHROPIC_API_KEY", label: "Anthropic" },
  { key: "OPENAI_API_KEY", label: "OpenAI" },
] as const;

export default function SettingsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});

  const token = useMemo(
    () => (session as { accessToken?: string })?.accessToken,
    [session]
  );

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: DEFAULTS,
  });

  const loadSettings = useCallback(async () => {
    if (!token) {
      if (sessionStatus === "authenticated") {
        toast.error("Authentication token not available");
        setLoading(false);
      }
      return;
    }

    try {
      const { config } = await api.getConfig(token);
      const mapped: Partial<SettingsForm> = {};
      
      for (const key of Object.keys(DEFAULTS) as (keyof SettingsForm)[]) {
        if (config[key] !== undefined) {
          if (key === "MAX_TOKENS") {
            mapped[key] = Number(config[key]);
          } else {
            (mapped as Record<string, string>)[key] = String(config[key] || "");
          }
        }
      }
      
      form.reset({ ...DEFAULTS, ...mapped });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [token, sessionStatus, form]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const onSubmit = useCallback(async (values: SettingsForm) => {
    if (!token) {
      toast.error("Not authenticated");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      for (const [key, val] of Object.entries(values)) {
        const strVal = String(val || "");
        if (!strVal.startsWith("***")) {
          payload[key] = strVal;
        }
      }

      await api.updateConfig(token, payload);
      toast.success("Settings saved successfully");
      await loadSettings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }, [token, loadSettings]);

  const handleReset = useCallback(() => {
    form.reset(DEFAULTS);
    toast.info("Reset to default values");
  }, [form]);

  const toggleFieldVisibility = useCallback((key: string) => {
    setVisibleFields(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

  const hasValue = useCallback((value: string | undefined) => {
    return value && value !== "" && !value.startsWith("***");
  }, []);

  const maxTokens = form.watch("MAX_TOKENS");
  const systemPrompt = form.watch("SYSTEM_PROMPT");

  if (sessionStatus === "unauthenticated") {
    return (
      <Card className="border-destructive max-w-2xl mx-auto mt-8">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-destructive">Authentication Required</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Please sign in to view and manage settings.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="mr-1 h-3 w-3" /> Reset to Defaults
        </Button>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Discord Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Discord Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="discord-token">Bot Token</Label>
              <div className="relative">
                <Input
                  id="discord-token"
                  type={visibleFields.DISCORD_TOKEN ? "text" : "password"}
                  {...form.register("DISCORD_TOKEN")}
                  className="pr-10 font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => toggleFieldVisibility("DISCORD_TOKEN")}
                >
                  {visibleFields.DISCORD_TOKEN ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {form.formState.errors.DISCORD_TOKEN && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.DISCORD_TOKEN.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bot Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bot Behavior</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="prefix">Command Prefix</Label>
              <Input
                id="prefix"
                {...form.register("BOT_PREFIX")}
                className="w-24 font-mono text-center"
              />
              {form.formState.errors.BOT_PREFIX && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.BOT_PREFIX.message}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Max Tokens</Label>
                <span className="text-sm font-mono tabular-nums text-muted-foreground">
                  {maxTokens}
                </span>
              </div>
              <Slider
                value={[maxTokens]}
                onValueChange={([val]) => form.setValue("MAX_TOKENS", val)}
                min={128}
                max={4096}
                step={64}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="system-prompt">System Prompt</Label>
                <span className="text-xs text-muted-foreground">
                  {systemPrompt?.length || 0} characters
                </span>
              </div>
              <Textarea
                id="system-prompt"
                {...form.register("SYSTEM_PROMPT")}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">API Keys</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Masked values (***...) are not overwritten on save. Enter a new value to update.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {API_KEY_FIELDS.map(({ key, label }) => {
                const value = form.watch(key);
                const isConfigured = hasValue(value);
                
                return (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key} className="flex items-center gap-2">
                      {label}
                      {isConfigured && (
                        <span className="text-xs text-green-500">✓</span>
                      )}
                    </Label>
                    <div className="relative">
                      <Input
                        id={key}
                        type={visibleFields[key] ? "text" : "password"}
                        {...form.register(key)}
                        className="pr-10 font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => toggleFieldVisibility(key)}
                      >
                        {visibleFields[key] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </form>
    </div>
  );
}