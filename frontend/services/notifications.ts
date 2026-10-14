import { apiClient, request } from "@/lib/api-client";
import { buildQuery, toPaginated } from "@/lib/api-utils";
import type { Notification, NotificationListParams } from "@/types/notifications";
import type { Paginated } from "@/types/ticket";

/**
 * Notifications service. Endpoints (FastAPI):
 *   GET    /notifications                       (own notifications only)
 *   GET    /notifications?unread_only=1         (for the bell count)
 *   PATCH  /notifications/{id}/read
 *   POST   /notifications/read-all
 */

export async function listNotifications(
  params: NotificationListParams = {}
): Promise<Paginated<Notification>> {
  const res = await request(() =>
    apiClient.get("/notifications", {
      params: buildQuery({
        page: params.page,
        page_size: params.page_size,
        unread_only: params.unread_only ? "1" : undefined,
      }),
    })
  );
  return toPaginated<Notification>(res);
}

export async function getUnreadCount(): Promise<number> {
  const res = await listNotifications({ unread_only: true, page: 1, page_size: 1 });
  const raw = (res as unknown as { unread_count?: number });
  return typeof raw.unread_count === "number" ? raw.unread_count : res.total;
}

export async function markNotificationRead(id: string): Promise<void> {
  await request(() => apiClient.patch(`/notifications/${id}/read`));
}

export async function markAllNotificationsRead(): Promise<void> {
  await request(() => apiClient.post("/notifications/read-all"));
}
