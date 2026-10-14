import { apiClient, request } from "@/lib/api-client";
import { buildQuery, toPaginated } from "@/lib/api-utils";
import type {
  AssignTicketRequest,
  CreateMessageRequest,
  CreateTicketRequest,
  Paginated,
  Ticket,
  TicketDetail,
  TicketListParams,
  UpdateTicketRequest,
} from "@/types/ticket";

/**
 * Tickets service. Endpoints (FastAPI):
 *   GET    /tickets                 (role-scoped list + filters/paging/sort)
 *   POST   /tickets
 *   GET    /tickets/{id}            (includes conversation)
 *   PATCH  /tickets/{id}            (field/status updates)
 *   POST   /tickets/{id}/messages   (public replies / internal notes)
 *   POST   /tickets/{id}/assign     (agent/admin only, enforced server-side)
 */

export async function listTickets(
  params: TicketListParams = {}
): Promise<Paginated<Ticket>> {
  const res = await request(() =>
    apiClient.get("/tickets", { params: buildQuery(params as Record<string, unknown>) })
  );
  return toPaginated<Ticket>(res);
}

export async function getTicket(id: string): Promise<TicketDetail> {
  const data = await request(() => apiClient.get(`/tickets/${id}`));
  const obj = data as Record<string, unknown>;
  // Tolerate `{ ticket, messages }` and flat `{ ...ticket, messages }`.
  if (obj.ticket && typeof obj.ticket === "object") {
    return { ...(obj.ticket as Ticket), messages: (obj.messages ?? []) as TicketDetail["messages"] };
  }
  return data as TicketDetail;
}

export async function createTicket(payload: CreateTicketRequest): Promise<Ticket> {
  const data = await request(() => apiClient.post("/tickets", payload));
  const obj = data as Record<string, unknown>;
  if (obj.ticket && typeof obj.ticket === "object") return obj.ticket as Ticket;
  return data as Ticket;
}

export async function updateTicket(
  id: string,
  payload: UpdateTicketRequest
): Promise<Ticket> {
  const data = await request(() => apiClient.patch(`/tickets/${id}`, payload));
  const obj = data as Record<string, unknown>;
  if (obj.ticket && typeof obj.ticket === "object") return obj.ticket as Ticket;
  return data as Ticket;
}

export async function addMessage(
  id: string,
  payload: CreateMessageRequest
): Promise<TicketDetail> {
  const data = await request(() =>
    apiClient.post(`/tickets/${id}/messages`, payload)
  );
  const obj = data as Record<string, unknown>;
  if (obj.ticket && typeof obj.ticket === "object") {
    return {
      ...(obj.ticket as Ticket),
      messages: (obj.messages ?? []) as TicketDetail["messages"],
    };
  }
  return data as TicketDetail;
}

export async function assignTicket(
  id: string,
  payload: AssignTicketRequest
): Promise<Ticket> {
  const data = await request(() =>
    apiClient.post(`/tickets/${id}/assign`, payload)
  );
  const obj = data as Record<string, unknown>;
  if (obj.ticket && typeof obj.ticket === "object") return obj.ticket as Ticket;
  return data as Ticket;
}
