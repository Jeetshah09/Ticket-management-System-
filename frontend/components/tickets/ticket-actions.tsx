"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserCheck, UserMinus, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tickets as ticketsApi, users as usersApi } from "@/services";
import { canManageTicket, isAdmin } from "@/lib/permissions";
import { STATUS_META } from "@/lib/constants";
import { TICKET_STATUSES, type Ticket, type TicketStatus } from "@/types/ticket";
import type { User } from "@/types/auth";

interface TicketActionsProps {
  ticket: Ticket;
  user: User | null;
  onChanged: (ticket: Ticket) => void;
}

/**
 * Workflow controls for agents/admins: status changes and assignment.
 *
 * - Status: PATCH /tickets/{id} — backend validates transitions.
 * - Assignment: POST /tickets/{id}/assign. Self-assign/unassign works
 *   for any authorized agent; admins additionally get a picker fed by
 *   GET /users?role=agent (if that call fails, only self-assign stays
 *   available rather than pretending to list agents).
 */
export function TicketActions({ ticket, user, onChanged }: TicketActionsProps) {
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<TicketStatus | null>(null);
  const [agentOptions, setAgentOptions] = useState<User[] | null>(null);

  if (!canManageTicket(user)) return null;

  const admin = isAdmin(user);

  const changeStatus = async (status: TicketStatus) => {
    setPending(true);
    try {
      const updated = await ticketsApi.updateTicket(ticket.id, { status });
      toast.success(`Status changed to ${STATUS_META[status].label}`);
      onChanged(updated);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update status"
      );
    } finally {
      setPending(false);
      setConfirmOpen(false);
      setNextStatus(null);
    }
  };

  const assign = async (assigneeId: string | null) => {
    setPending(true);
    try {
      const updated = await ticketsApi.assignTicket(ticket.id, {
        assignee_id: assigneeId,
      });
      toast.success(
        assigneeId === null
          ? "Ticket unassigned"
          : assigneeId === user?.id
            ? "Ticket assigned to you"
            : "Ticket reassigned"
      );
      onChanged(updated);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update assignment"
      );
    } finally {
      setPending(false);
    }
  };

  const openAgentPicker = async () => {
    if (agentOptions) return;
    try {
      const page = await usersApi.listUsers({ role: "agent", page_size: 100 });
      // Include admins too — they can also own tickets.
      const admins = await usersApi.listUsers({ role: "admin", page_size: 50 });
      setAgentOptions([...page.items, ...admins.items]);
    } catch {
      // Keep self-assign only; don't show a broken picker.
      setAgentOptions([]);
      toast.error(
        "Agent list unavailable — you can still assign this ticket to yourself."
      );
    }
  };

  const isSelfAssigned = ticket.assignee?.id === user?.id;

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Workflow className="h-3.5 w-3.5" aria-hidden="true" />
          Status
        </p>
        <Select
          value={ticket.status}
          disabled={pending}
          onValueChange={(v) => {
            const status = v as TicketStatus;
            if (status === "closed" || status === "resolved") {
              setNextStatus(status);
              setConfirmOpen(true);
            } else {
              void changeStatus(status);
            }
          }}
        >
          <SelectTrigger className="w-full" aria-label="Change ticket status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TICKET_STATUSES.map((s) => (
              <SelectItem key={s} value={s} disabled={s === ticket.status}>
                {STATUS_META[s].label}
                {s === ticket.status ? " (current)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Assignment
        </p>

        <div className="flex flex-col gap-2">
          {ticket.assignee ? (
            <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="truncate">
                {ticket.assignee.name || ticket.assignee.email}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 shrink-0"
                disabled={pending}
                onClick={() => void assign(null)}
              >
                <UserMinus aria-hidden="true" /> Unassign
              </Button>
            </div>
          ) : null}

          {!isSelfAssigned && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => void assign(user?.id ?? null)}
            >
              <UserCheck aria-hidden="true" /> Assign to me
            </Button>
          )}

          {admin && (
            <Select
              disabled={pending}
              onValueChange={(v) => void assign(v)}
              onOpenChange={(open) => {
                if (open) void openAgentPicker();
              }}
            >
              <SelectTrigger className="w-full" aria-label="Assign to team member">
                <SelectValue placeholder="Assign to someone…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" disabled>
                  {agentOptions === null ? "Loading team…" : "No team members found"}
                </SelectItem>
                {(agentOptions ?? [])
                  .filter((u) => u.id !== user?.id && u.id !== ticket.assignee?.id)
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.email}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Confirmation for consequential status changes */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Mark as {nextStatus ? STATUS_META[nextStatus].label.toLowerCase() : "this status"}?
            </DialogTitle>
            <DialogDescription>
              This changes the ticket status for everyone watching it. The
              customer may be notified of the change.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={pending}
              onClick={() => nextStatus && void changeStatus(nextStatus)}
            >
              Confirm change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
