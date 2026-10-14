import type { TicketPriority, TicketStatus, Role } from "@/types";

/**
 * Single source of truth for UI labels/colors of backend enum values.
 * Values are lowercase and MUST match the FastAPI Pydantic enums.
 * If the backend changes its enums, update these maps (and types).
 */

export const STATUS_META: Record<
  TicketStatus,
  { label: string; badgeClass: string }
> = {
  open: {
    label: "Open",
    badgeClass: "bg-blue-50 text-blue-700 ring-blue-200",
  },
  in_progress: {
    label: "In Progress",
    badgeClass: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  pending: {
    label: "Pending",
    badgeClass: "bg-violet-50 text-violet-700 ring-violet-200",
  },
  resolved: {
    label: "Resolved",
    badgeClass: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  closed: {
    label: "Closed",
    badgeClass: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  },
};

export const PRIORITY_META: Record<
  TicketPriority,
  { label: string; badgeClass: string; dotClass: string }
> = {
  low: {
    label: "Low",
    badgeClass: "bg-zinc-100 text-zinc-700 ring-zinc-200",
    dotClass: "bg-zinc-400",
  },
  medium: {
    label: "Medium",
    badgeClass: "bg-sky-50 text-sky-700 ring-sky-200",
    dotClass: "bg-sky-500",
  },
  high: {
    label: "High",
    badgeClass: "bg-orange-50 text-orange-700 ring-orange-200",
    dotClass: "bg-orange-500",
  },
  urgent: {
    label: "Urgent",
    badgeClass: "bg-red-50 text-red-700 ring-red-200",
    dotClass: "bg-red-500",
  },
};

export const ROLE_META: Record<Role, { label: string; badgeClass: string }> = {
  customer: { label: "Customer", badgeClass: "bg-sky-50 text-sky-700 ring-sky-200" },
  agent: { label: "Agent", badgeClass: "bg-violet-50 text-violet-700 ring-violet-200" },
  admin: { label: "Admin", badgeClass: "bg-blue-50 text-blue-700 ring-blue-200" },
};

export const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "customer", label: "Customer" },
  { value: "agent", label: "Agent" },
  { value: "admin", label: "Admin" },
];

/** Page-size options shared by all list views. */
export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;
