"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import type { ProvidersResponse } from "@/lib/api";
import { ProviderCard } from "@/components/providers/provider-card";
import { FallbackChain } from "@/components/providers/fallback-chain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ProvidersPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [data, setData] = useState<ProvidersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const token = useMemo(
    () => (session as { accessToken?: string })?.accessToken,
    [session]
  );

  const load = useCallback(async (showRefreshingState = false) => {
    if (!token) {
      if (sessionStatus === "authenticated") {
        setError("Authentication token not available");
        setLoading(false);
      }
      return;
    }

    try {
      if (showRefreshingState) {
        setRefreshing(true);
      }
      
      setError(null);
      const result = await api.getProviders(token);
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load providers";
      setError(errorMessage);
      toast.error(errorMessage, {
        duration: 5000,
        action: {
          label: "Retry",
          onClick: () => load(true),
        },
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, sessionStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSetPrimary = useCallback(async (name: string) => {
    if (!token) {
      toast.error("Not authenticated");
      return;
    }

    // Optimistic update
    const previousData = data;
    setData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        providers: prev.providers.map(p => ({
          ...p,
          is_primary: p.name === name
        }))
      };
    });

    try {
      await api.setPrimaryProvider(token, name);
      toast.success(`${name} is now your primary provider`, {
        description: "All new requests will use this provider by default.",
      });
      await load(true); // Refresh to ensure consistency
    } catch (err) {
      // Rollback on error
      setData(previousData);
      const errorMessage = err instanceof Error ? err.message : "Failed to set primary provider";
      toast.error(errorMessage, {
        duration: 5000,
      });
    }
  }, [token, data, load]);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    load(true);
  }, [load]);

  // Loading state
  if (loading && !refreshing) {
    return (
      <div 
        className="flex flex-col items-center justify-center py-12 space-y-4"
        role="status"
        aria-label="Loading providers"
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading providers...</p>
      </div>
    );
  }

  // Unauthenticated state
  if (sessionStatus === "unauthenticated") {
    return (
      <Card className="border-destructive max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-destructive">Authentication Required</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Please sign in to view and manage your providers.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Providers</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Refresh providers"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Error state - using Card instead of Alert */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive">Error Loading Providers</h3>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => load(true)}
                disabled={refreshing}
                className="shrink-0"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fallback chain */}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fallback Chain</CardTitle>
          </CardHeader>
          <CardContent>
            <FallbackChain
              fallbackOrder={data.fallback_order}
              providers={data.providers}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              When the primary provider fails, requests automatically fall through to the next available provider.
              {data.fallback_order.length === 0 && (
                <span className="block mt-1 text-amber-600 dark:text-amber-500">
                  ⚠️ No fallback providers configured. Enable additional providers to improve reliability.
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Provider grid */}
      {data?.providers.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">No providers available</p>
              <p className="text-sm text-muted-foreground">
                Contact your administrator to configure AI providers.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div 
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          role="list"
          aria-label="Available providers"
        >
          {data?.providers.map((provider) => (
            <ProviderCard
              key={provider.name}
              provider={provider}
              token={token!}
              onSetPrimary={handleSetPrimary}
              // Removed isRefreshing prop as it's not accepted by ProviderCard
            />
          ))}
        </div>
      )}

      {/* Status summary - removed enabled/disabled counts */}
      {data && data.providers.length > 0 && (
        <div className="text-sm text-muted-foreground border-t pt-4">
          <p>
            {data.providers.length} total providers •{" "}
            {data.fallback_order.length} in fallback chain •{" "}
            Primary: {data.providers.find(p => p.is_primary)?.name || 'None set'}
          </p>
        </div>
      )}
    </div>
  );
}