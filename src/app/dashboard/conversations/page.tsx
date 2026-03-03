"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Loader2, AlertCircle, RefreshCw, Search, MessageSquare, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { ChannelItem } from "@/lib/api";
import { ChannelList } from "@/components/conversations/channel-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// Use the imported ChannelItem type directly
type Channel = ChannelItem;

export default function ConversationsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [filteredChannels, setFilteredChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null);
  const [deleting, setDeleting] = useState(false);

  const token = useMemo(
    () => (session as { accessToken?: string })?.accessToken,
    [session]
  );

  // Filter channels based on search query
  useEffect(() => {
    if (!channels) return;
    
    if (!searchQuery.trim()) {
      setFilteredChannels(channels);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = channels.filter((channel) => {
        // Handle different possible property names
        const channelId = (channel as any).channel_id || (channel as any).id || '';
        const channelName = (channel as any).channel_name || (channel as any).name || (channel as any).displayName || '';
        
        return (
          String(channelName).toLowerCase().includes(query) ||
          String(channelId).toLowerCase().includes(query)
        );
      });
      setFilteredChannels(filtered);
    }
  }, [channels, searchQuery]);

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
      const result = await api.getConversations(token);
      
      // Handle the response structure
      const channelsData = result.channels || [];
      setChannels(channelsData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load conversations";
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

  const handleDelete = useCallback(async () => {
    if (!token || !channelToDelete) return;

    setDeleting(true);
    try {
      // Get the channel ID - handle different property names
      const channelId = (channelToDelete as any).channel_id || (channelToDelete as any).id;
      if (!channelId) {
        throw new Error("Channel ID not found");
      }

      await api.deleteConversation(token, channelId);
      
      // Get display name for toast message
      const displayName = (channelToDelete as any).channel_name || 
                         (channelToDelete as any).name || 
                         (channelToDelete as any).displayName || 
                         channelId;
      
      toast.success(`Cleared conversation for #${displayName}`, {
        description: "All messages in this channel have been deleted.",
      });
      
      // Remove from local state
      setChannels(prev => prev.filter(c => {
        const cId = (c as any).channel_id || (c as any).id;
        return cId !== channelId;
      }));
      
      setDeleteDialogOpen(false);
      setChannelToDelete(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete conversation";
      toast.error(errorMessage, {
        duration: 5000,
      });
    } finally {
      setDeleting(false);
    }
  }, [token, channelToDelete]);

  const confirmDelete = useCallback((channelId: string) => {
    // Find the channel by ID
    const channel = channels.find(c => {
      const cId = (c as any).channel_id || (c as any).id;
      return cId === channelId;
    });
    
    if (channel) {
      setChannelToDelete(channel);
      setDeleteDialogOpen(true);
    } else {
      toast.error("Channel not found", {
        description: "The channel may have been deleted. Refreshing...",
      });
      load(true); // Refresh the list
    }
  }, [channels, load]);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    load(true);
  }, [load]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  // Get display name for a channel
  const getChannelDisplayName = useCallback((channel: Channel) => {
    return (channel as any).channel_name || 
           (channel as any).name || 
           (channel as any).displayName || 
           (channel as any).channel_id || 
           (channel as any).id || 
           'Unknown Channel';
  }, []);

  // Loading state
  if (loading && !refreshing) {
    return (
      <div 
        className="flex flex-col items-center justify-center py-12 space-y-4"
        role="status"
        aria-label="Loading conversations"
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading conversations...</p>
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
                Please sign in to view and manage conversations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Conversations</h1>
          <p className="text-sm text-muted-foreground">
            Manage channel-specific conversation histories
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="self-start sm:self-auto"
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
                <h3 className="font-semibold text-destructive">Error Loading Conversations</h3>
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

      {/* Search and stats */}
      {channels.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by channel name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1.5 h-7 w-7 p-0"
                onClick={handleClearSearch}
              >
                <span className="sr-only">Clear search</span>
                <AlertCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredChannels.length} of {channels.length} channels
          </div>
        </div>
      )}

      {/* Main content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span>Channel Conversations</span>
            </div>
            {channels.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                {channels.length} total
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!channels || channels.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground">No conversations found</p>
              <p className="text-sm text-muted-foreground">
                Conversations will appear here once users interact with the bot in Discord channels.
              </p>
            </div>
          ) : filteredChannels.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <Search className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground">No matching channels</p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search query or{" "}
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-sm"
                  onClick={handleClearSearch}
                >
                  clear the filter
                </Button>
              </p>
            </div>
          ) : (
            <ChannelList 
              channels={filteredChannels} 
              onDelete={confirmDelete}
            />
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to clear the conversation for{" "}
              <span className="font-mono font-medium">
                #{channelToDelete ? getChannelDisplayName(channelToDelete) : ''}
              </span>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-muted-foreground">
                  This action cannot be undone. All messages in this channel's conversation history will be permanently deleted.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setChannelToDelete(null);
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear Conversation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status summary */}
      {channels.length > 0 && (
        <div className="text-sm text-muted-foreground border-t pt-4">
          <p>
            {channels.length} active conversation{channels.length !== 1 ? 's' : ''} •{" "}
            Last updated: {new Date().toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}