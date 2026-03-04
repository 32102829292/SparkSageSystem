"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle2, XCircle, Loader2, ExternalLink, ChevronDown } from "lucide-react";
import { useWizardStore } from "../../stores/wizard-store";
import { api } from "../../lib/api";
import { PROVIDER_INFO } from "../../types/provider";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Badge } from "../ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";

const FREE_PROVIDERS = ["gemini", "groq", "openrouter"];
const PAID_PROVIDERS = ["anthropic", "openai"];

interface TestResult {
  success: boolean;
  message: string;
}

interface ProviderCardProps {
  id: string;
  apiKey: string;
  result: TestResult | undefined;
  testing: boolean;
  onKeyChange: (id: string, key: string) => void;
  onTest: (id: string) => void;
}

function ProviderCard({ id, apiKey, result, testing, onKeyChange, onTest }: ProviderCardProps) {
  const info = PROVIDER_INFO[id];

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RadioGroupItem value={id} id={`primary-${id}`} disabled={!apiKey} />
            <Label htmlFor={`primary-${id}`} className="font-medium cursor-pointer">
              {info.name}
            </Label>
            <Badge variant={info.free ? "secondary" : "outline"}>
              {info.free ? "Free" : "Paid"}
            </Badge>
          </div>
          <a
            href={info.getKeyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Get API Key <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <p className="text-xs text-muted-foreground">{info.description}</p>
        <div className="flex gap-2">
          <Input
            type="password"
            placeholder={`${info.name} API key`}
            value={apiKey}
            onChange={(e) => onKeyChange(id, e.target.value)}
            className="font-mono text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => onTest(id)}
            disabled={!apiKey || testing}
            className="shrink-0"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
          </Button>
        </div>
        {result && (
          <div className={`flex items-center gap-1.5 text-xs ${result.success ? "text-green-600" : "text-destructive"}`}>
            {result.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            {result.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StepProviders() {
  const { data: session } = useSession();
  const { data, updateData } = useWizardStore();
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [paidOpen, setPaidOpen] = useState(false);

  const token = (session as { accessToken?: string })?.accessToken;

  const hasAtLeastOneKey = Object.values(data.providers).some((key) => key.length > 0);

  function setProviderKey(providerId: string, apiKey: string) {
    updateData({
      providers: { ...data.providers, [providerId]: apiKey },
    });
  }

  async function handleTest(providerId: string) {
    const apiKey = data.providers[providerId];
    if (!apiKey || !token) return;

    setTestingProvider(providerId);
    try {
      const result = await api.testProvider(token, providerId);
      setTestResults((prev) => ({
        ...prev,
        [providerId]: { success: result.success, message: result.message },
      }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [providerId]: {
          success: false,
          message: err instanceof Error ? err.message : "Test failed",
        },
      }));
    } finally {
      setTestingProvider(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>AI Providers</CardTitle>
          <CardDescription>
            Configure at least one AI provider. Free providers are used as automatic fallbacks.
            Select which provider to use as primary.
          </CardDescription>
        </CardHeader>
      </Card>

      <RadioGroup
        value={data.primaryProvider}
        onValueChange={(value) => updateData({ primaryProvider: value })}
        className="space-y-3"
      >
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Free Providers</h3>
          {FREE_PROVIDERS.map((id) => (
            <ProviderCard
              key={id}
              id={id}
              apiKey={data.providers[id] || ""}
              result={testResults[id]}
              testing={testingProvider === id}
              onKeyChange={setProviderKey}
              onTest={handleTest}
            />
          ))}
        </div>

        <Collapsible open={paidOpen} onOpenChange={setPaidOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-sm text-muted-foreground">
              Paid Providers (Optional)
              <ChevronDown className={`h-4 w-4 transition-transform ${paidOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            {PAID_PROVIDERS.map((id) => (
              <ProviderCard
                key={id}
                id={id}
                apiKey={data.providers[id] || ""}
                result={testResults[id]}
                testing={testingProvider === id}
                onKeyChange={setProviderKey}
                onTest={handleTest}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      </RadioGroup>

      {!hasAtLeastOneKey && (
        <p className="text-sm text-destructive">
          Please configure at least one provider API key to continue.
        </p>
      )}
    </div>
  );
}