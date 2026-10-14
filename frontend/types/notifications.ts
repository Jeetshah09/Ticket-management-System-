import type { UserSummary } from "./auth";
import type { TicketPriority, TicketStatus } from "./ticket";

export interface Notification {
  id: string;
  title: string;
  body?: string | null;
  /** Ticket this notification refers to, when applicable. */
  ticket_id?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListParams {
  page?: number;
  page_size?: number;
  unread_only?: boolean;
}

/* ---------------------------------- analytics --------------------------------- */

export interface MetricBucket {
  key: string;
  label: string;
  count: number;
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface AnalyticsOverview {
  total_tickets: number;
  open_tickets: number;
  resolved_tickets?: number;
  unassigned_tickets?: number;
  avg_first_response_hours?: number | null;
  /** Admin-only metrics (absent for other roles). */
  total_users?: number;
  total_categories?: number;
  by_status: MetricBucket[];
  by_priority: MetricBucket[];
  by_category?: MetricBucket[];
  created_trend?: TrendPoint[];
}

export interface AgentWorkload {
  agent: UserSummary;
  open_tickets: number;
  total_tickets: number;
}

/* --------------------------------- audit logs -------------------------------- */

export interface AuditLogEntry {
  id: string;
  action: string;
  actor: UserSummary | null;
  entity_type?: string | null;
  entity_id?: string | null;
  details?: string | null;
  ip_address?: string | null;
  created_at: string;
}

export interface AuditLogListParams {
  page?: number;
  page_size?: number;
  action?: string;
  actor_id?: string;
  entity_type?: string;
}

/* ------------------------------------ users ---------------------------------- */

export interface UserListParams {
  page?: number;
  page_size?: number;
  search?: string;
  role?: string;
}

export interface UpdateUserRequest {
  role?: string;
  is_active?: boolean;
}

export type TicketStatusFilter = TicketStatus | "";
export type TicketPriorityFilter = TicketPriority | "";
