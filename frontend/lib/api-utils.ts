import type {
  AnalyticsOverview,
  AgentWorkload,
  AuditLogEntry,
  AuditLogListParams,
  Notification,
  NotificationListParams,
  Paginated,
  UpdateUserRequest,
  User,
  UserListParams,
} from "@/types";

/* ------------------------------- helpers ------------------------------- */

/**
 * Accepts either the canonical `{ items, total, page, page_size, pages }`
 * envelope or a `{ data, meta }` variant and returns the canonical shape.
 * This is shape adaptation, not fake data — an unparseable response
 * still produces an error.
 */
export function toPaginated<T>(raw: unknown): Paginated<T> {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const source = (obj.data ?? obj.results ?? obj) as unknown;

  // Locate the array: either the variant IS an array, or it nests one.
  const list: unknown[] = Array.isArray(source)
    ? source
    : Array.isArray((source as Record<string, unknown>)?.items)
      ? ((source as Record<string, unknown>).items as unknown[])
      : Array.isArray((source as Record<string, unknown>)?.results)
        ? ((source as Record<string, unknown>).results as unknown[])
        : Array.isArray((source as Record<string, unknown>)?.data)
          ? ((source as Record<string, unknown>).data as unknown[])
          : Array.isArray(obj.items)
            ? obj.items
            : [];
  const items = list as T[];

  const meta = (obj.meta ?? (Array.isArray(source) ? obj : source)) as Record<string, unknown>;
  const total = Number(meta.total ?? items.length);
  const page = Number(meta.page ?? meta.current_page ?? 1);
  const pageSize = Number(
    meta.page_size ?? meta.pageSize ?? meta.per_page ?? meta.limit ?? items.length
  );
  const pages = Number(
    meta.pages ?? meta.total_pages ??
      (pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1)
  );

  return {
    items: Array.isArray(items) ? items : [],
    total: Number.isFinite(total) ? total : 0,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    page_size: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : items.length || 10,
    pages: Number.isFinite(pages) && pages > 0 ? pages : 1,
  };
}

/** Query-string builder that drops empty/undefined values. */
export function buildQuery(params: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!params) return out;
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = String(v);
  }
  return out;
}

export type {
  AnalyticsOverview,
  AgentWorkload,
  AuditLogEntry,
  AuditLogListParams,
  Notification,
  NotificationListParams,
  Paginated,
  UpdateUserRequest,
  User,
  UserListParams,
};
