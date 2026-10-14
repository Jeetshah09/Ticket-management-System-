"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck, MailOpen } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { notifications as notificationsApi } from "@/services";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types/notifications";

function NotificationsInner() {
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const [onlyUnread, setOnlyUnread] = useState(false);

  const list = useApi(
    () =>
      notificationsApi.listNotifications({
        page,
        page_size: 20,
        unread_only: onlyUnread || undefined,
      }),
    [page, onlyUnread]
  );

  const markRead = useCallback(
    async (notification: Notification) => {
      if (notification.is_read) return;
      try {
        await notificationsApi.markNotificationRead(notification.id);
        list.reload();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not update notification"
        );
      }
    },
    [list]
  );

  const markAll = async () => {
    try {
      await notificationsApi.markAllNotificationsRead();
      toast.success("All notifications marked as read");
      list.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update notifications"
      );
    }
  };

  const setPage = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextPage <= 1) params.delete("page");
      else params.set("page", String(nextPage));
      window.history.replaceState(null, "", `/notifications?${params.toString()}`);
      list.reload();
    },
    [searchParams, list]
  );

  const items = list.data?.items ?? [];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Notifications"
        description="Replies, assignments, and status changes on your tickets."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Notifications" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={onlyUnread ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setOnlyUnread((v) => !v);
                window.history.replaceState(null, "", "/notifications");
              }}
              aria-pressed={onlyUnread}
            >
              <Bell aria-hidden="true" />
              {onlyUnread ? "Showing unread" : "Unread only"}
            </Button>
            <Button variant="outline" size="sm" onClick={markAll}>
              <CheckCheck aria-hidden="true" /> Mark all read
            </Button>
          </div>
        }
      />

      {list.loading && <TableSkeleton rows={6} />}
      {!list.loading && list.error && (
        <ErrorState error={list.error} onRetry={list.reload} />
      )}

      {!list.loading && !list.error && (
        <div className="rounded-xl border bg-card shadow-sm">
          {items.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Bell}
                title={onlyUnread ? "No unread notifications" : "No notifications yet"}
                description="You'll be notified when someone replies to your tickets or a status changes."
              />
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id}>
                  <div
                    className={cn(
                      "flex items-start gap-3 px-4 py-3.5 transition-colors",
                      !n.is_read && "bg-primary/[0.04]"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        n.is_read ? "bg-muted-foreground/30" : "bg-primary"
                      )}
                      aria-label={n.is_read ? "Read" : "Unread"}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{n.title}</p>
                      {n.body && (
                        <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {n.ticket_id && (
                        <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                          <Link href={`/tickets/${n.ticket_id}`}>View ticket</Link>
                        </Button>
                      )}
                      {!n.is_read && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => void markRead(n)}
                        >
                          <MailOpen aria-hidden="true" /> Mark read
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="px-4">
            <Pagination
              page={list.data?.page ?? 1}
              pages={list.data?.pages ?? 1}
              total={list.data?.total ?? 0}
              pageSize={list.data?.page_size ?? 20}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={6} />}>
      <NotificationsInner />
    </Suspense>
  );
}
