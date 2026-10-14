"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useApi } from "@/hooks/use-api";
import { notifications as notificationsApi } from "@/services";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Header notification bell: unread count badge + latest items.
 * Counts and items come from the backend; failures degrade to an
 * inline hint rather than fake numbers.
 */
export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const { data, loading, error, reload } = useApi(async () => {
    const [recent, unread] = await Promise.all([
      notificationsApi.listNotifications({ page: 1, page_size: 6 }),
      notificationsApi.getUnreadCount(),
    ]);
    return { recent, unread };
  }, [user?.id ?? "anon", open ? 1 : 0]);

  const items = data?.recent.items ?? [];
  const unreadCount = data?.unread ?? 0;

  const handleMarkAll = async () => {
    try {
      await notificationsApi.markAllNotificationsRead();
      toast.success("All notifications marked as read");
      reload();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update notifications"
      );
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={
          unreadCount > 0
            ? `Notifications: ${unreadCount} unread`
            : "Notifications"
        }>
          <Bell aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={handleMarkAll}
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading && (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              Could not load notifications. Check that the backend is running.
            </p>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="flex flex-col items-center px-4 py-8 text-center">
              <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 text-xs text-muted-foreground">
                You&apos;re all caught up.
              </p>
            </div>
          )}

          {!loading &&
            !error &&
            items.map((n) => (
              <Link
                key={n.id}
                href={n.ticket_id ? `/tickets/${n.ticket_id}` : "/notifications"}
                onClick={() => setOpen(false)}
                className={cn(
                  "block border-b px-4 py-3 transition-colors last:border-0 hover:bg-accent",
                  !n.is_read && "bg-primary/[0.04]"
                )}
              >
                <div className="flex items-start gap-2">
                  {!n.is_read && (
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                      aria-label="Unread"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {n.body}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
        </div>

        <div className="border-t p-2">
          <Button asChild variant="ghost" className="w-full justify-center text-xs" size="sm">
            <Link href="/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
