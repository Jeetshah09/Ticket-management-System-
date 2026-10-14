"use client";

import { format } from "date-fns";
import { Lock, MessageSquare, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ROLE_META } from "@/lib/constants";
import type { TicketMessage } from "@/types/ticket";

function initials(name: string, email: string): string {
  const source = (name || email).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (source.slice(0, 2) || "?").toUpperCase();
}

/**
 * Chronological conversation thread. Public replies and internal notes
 * are visually distinct (amber panel + lock icon + "Internal note"
 * label), so visibility is never conveyed by color alone.
 *
 * Note: the backend also strips internal notes from customer responses;
 * this component only renders what the API returns.
 */
export function Conversation({ messages }: { messages: TicketMessage[] }) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <MessageSquare className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <p className="mt-2 text-sm text-muted-foreground">
          No messages yet. Start the conversation below.
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-4">
      {messages.map((message) => {
        const internal = message.visibility === "internal";
        return (
          <li
            key={message.id}
            className={cn(
              "rounded-xl border p-4",
              internal ? "border-amber-200 bg-amber-50/60" : "bg-card"
            )}
          >
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {initials(message.author?.name ?? "", message.author?.email ?? "")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold">
                    {message.author?.name || message.author?.email || "Unknown user"}
                  </span>
                  {message.author?.role && (
                    <Badge variant="outline" className="text-[10px] ring-1 ring-inset">
                      {ROLE_META[message.author.role]?.label ?? message.author.role}
                    </Badge>
                  )}
                  {internal && (
                    <Badge className="bg-amber-100 text-amber-800 ring-amber-200 ring-1 ring-inset">
                      <Lock className="h-3 w-3" aria-hidden="true" />
                      Internal note
                    </Badge>
                  )}
                  <time
                    dateTime={message.created_at}
                    className="ml-auto text-xs text-muted-foreground"
                  >
                    {format(new Date(message.created_at), "MMM d, yyyy h:mm a")}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {message.body}
                </p>
                {internal && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-700">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Visible to agents and administrators only
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
