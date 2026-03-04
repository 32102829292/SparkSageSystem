"use client";

import type { MessageItem } from "../../lib/api";
import { Badge } from "../ui/badge";

interface MessageListProps {
  messages: MessageItem[];
}

/**
 * Robustly parses a timestamp that may come from asyncpg/PostgreSQL.
 *
 * asyncpg returns datetimes as Python datetime objects. When serialized
 * to JSON they can arrive in several formats:
 *   - "2024-04-30T20:37:44+00:00"   ← ideal ISO 8601 (fixed in backend)
 *   - "2024-04-30 20:37:44+00:00"   ← space instead of T (common asyncpg default)
 *   - "2024-04-30T20:37:44.123456Z" ← with microseconds
 *   - 1714500000000                  ← unix ms (less common)
 *
 * The fix: replace the space separator with "T" so every browser's
 * Date constructor can parse it correctly.
 */
function parseDate(dateStr: string | number | null | undefined): Date | null {
  if (!dateStr) return null;

  // Already a number (unix ms)
  if (typeof dateStr === "number") {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  // Normalize: replace space-separated datetime (asyncpg default) with ISO T
  const normalized = dateStr.trim().replace(" ", "T");

  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

function formatTime(dateStr: string | number | null | undefined): string {
  const date = parseDate(dateStr);
  if (!date) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string | number | null | undefined): string {
  const date = parseDate(dateStr);
  if (!date) return "—";

  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No messages in this channel.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((msg, i) => {
        const isUser = msg.role === "user";
        return (
          <div
            key={i}
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-lg px-4 py-2 ${
                isUser ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              <div
                className={`mt-1 flex items-center gap-2 text-xs ${
                  isUser ? "opacity-70" : "text-muted-foreground"
                }`}
              >
                <span>{formatDate(msg.created_at)}</span>
                {msg.provider && !isUser && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                    {msg.provider}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}