import type { Role } from "@/types";

/**
 * Frontend navigation/permission helpers.
 *
 * IMPORTANT: these only control what the UI shows. The FastAPI backend
 * remains the authoritative permission layer — every request is still
 * authenticated and authorized server-side, and a 403 response is
 * surfaced as an access-denied state.
 */

export function hasRole(user: { role: Role } | null, ...roles: Role[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}

export const isCustomer = (user: { role: Role } | null) => hasRole(user, "customer");
export const isAgent = (user: { role: Role } | null) => hasRole(user, "agent");
export const isAdmin = (user: { role: Role } | null) => hasRole(user, "admin");

/** Agent + admin can work the shared ticket queue. */
export const canWorkTickets = (user: { role: Role } | null) =>
  hasRole(user, "agent", "admin");

/** Only agent/admin may add internal notes (when the backend allows it). */
export const canAddInternalNote = (user: { role: Role } | null) =>
  hasRole(user, "agent", "admin");

/** Only agent/admin may change status/assignment. */
export const canManageTicket = (user: { role: Role } | null) =>
  hasRole(user, "agent", "admin");

export const canAssignTickets = (user: { role: Role } | null) =>
  hasRole(user, "agent", "admin");

export const isAdminArea = (user: { role: Role } | null) => isAdmin(user);

/**
 * Where a user lands after signing in (or registering):
 * customer → dashboard, agent → the ticket queue, admin → dashboard.
 */
export function landingPathFor(role: Role): string {
  return role === "agent" ? "/tickets" : "/dashboard";
}
