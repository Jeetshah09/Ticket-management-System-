import { apiClient, request } from "@/lib/api-client";
import type { AnalyticsOverview, AgentWorkload } from "@/types/notifications";
import type { Paginated } from "@/types/ticket";

/**
 * Analytics service. Endpoints (FastAPI):
 *   GET /analytics/overview   — role-appropriate aggregate metrics
 *   GET /analytics/agents     — per-agent workload (admin)
 *
 * All numbers come from the backend; the UI never fabricates metrics.
 * Failures surface as an error state with a retry action.
 */

export async function getOverview(): Promise<AnalyticsOverview> {
  const data = await request(() => apiClient.get("/analytics/overview"));
  const obj = (data ?? {}) as Partial<AnalyticsOverview> & {
    totals?: Partial<AnalyticsOverview>;
  };
  // Tolerate a `{ totals: {...}, breakdowns: {...} }` backend variant
  // by merging known fields onto the canonical shape.
  const totals = obj.totals ?? {};
  return {
    total_tickets: obj.total_tickets ?? totals.total_tickets ?? 0,
    open_tickets: obj.open_tickets ?? totals.open_tickets ?? 0,
    resolved_tickets: obj.resolved_tickets ?? totals.resolved_tickets,
    unassigned_tickets: obj.unassigned_tickets ?? totals.unassigned_tickets,
    avg_first_response_hours:
      obj.avg_first_response_hours ?? totals.avg_first_response_hours ?? null,
    total_users: obj.total_users ?? totals.total_users,
    total_categories: obj.total_categories ?? totals.total_categories,
    by_status: obj.by_status ?? [],
    by_priority: obj.by_priority ?? [],
    by_category: obj.by_category ?? [],
    created_trend: obj.created_trend ?? [],
  };
}

export async function getAgentWorkloads(): Promise<AgentWorkload[]> {
  const res = await request(() => apiClient.get("/analytics/agents"));
  if (Array.isArray(res)) return res as AgentWorkload[];
  const page = res as unknown as Paginated<AgentWorkload>;
  if (page && Array.isArray(page.items)) return page.items;
  const obj = res as unknown as Record<string, unknown>;
  if (Array.isArray(obj.items)) return obj.items as AgentWorkload[];
  return [];
}
