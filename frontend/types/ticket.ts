import type { UserSummary } from "./auth";

/**
 * Ticket domain types. Enum values MUST match the backend's Pydantic
 * enums exactly — see lib/constants.ts for the single source of labels
 * and colors used by the UI.
 */

export const TICKET_STATUSES = [
  "open",
  "in_progress",
  "pending",
  "resolved",
  "closed",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const MESSAGE_VISIBILITIES = ["public", "internal"] as const;
export type MessageVisibility = (typeof MESSAGE_VISIBILITIES)[number];

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TicketMessage {
  id: string;
  ticket_id?: string;
  author: UserSummary;
  body: string;
  visibility: MessageVisibility;
  created_at: string;
}

export interface Ticket {
  id: string;
  ticket_number?: string | number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category?: Category | null;
  category_id?: string | null;
  requester?: UserSummary | null;
  assignee?: UserSummary | null;
  /** Who moved the ticket into a resolved/closed state. */
  resolved_by?: UserSummary | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export interface TicketDetail extends Ticket {
  messages: TicketMessage[];
}

export interface CreateTicketRequest {
  subject: string;
  description: string;
  category_id: string;
  priority: TicketPriority;
}

export interface UpdateTicketRequest {
  subject?: string;
  description?: string;
  category_id?: string;
  priority?: TicketPriority;
  status?: TicketStatus;
}

export interface CreateMessageRequest {
  body: string;
  visibility: MessageVisibility;
}

export interface AssignTicketRequest {
  assignee_id: string | null;
}

/** Common paginated envelope returned by list endpoints. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

/** Filters accepted by GET /tickets (all optional). */
export interface TicketListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: TicketStatus | "";
  priority?: TicketPriority | "";
  category_id?: string;
  assignee_id?: string;
  requester_id?: string;
  sort_by?: "created_at" | "updated_at" | "priority" | "status";
  sort_order?: "asc" | "desc";
}
