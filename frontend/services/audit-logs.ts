import { apiClient, request } from "@/lib/api-client";
import { buildQuery, toPaginated } from "@/lib/api-utils";
import type { AuditLogEntry, AuditLogListParams } from "@/types/notifications";
import type { Paginated } from "@/types/ticket";

/**
 * Audit log service (admin only). Endpoint (FastAPI):
 *   GET /audit-logs   — paginated, filterable by action/actor/entity
 */

export async function listAuditLogs(
  params: AuditLogListParams = {}
): Promise<Paginated<AuditLogEntry>> {
  const res = await request(() =>
    apiClient.get("/audit-logs", {
      params: buildQuery({
        page: params.page,
        page_size: params.page_size,
        action: params.action,
        actor_id: params.actor_id,
        entity_type: params.entity_type,
      }),
    })
  );
  return toPaginated<AuditLogEntry>(res);
}
