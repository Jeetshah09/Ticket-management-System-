"use client";

import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { CircleUser, UserCheck, CheckCircle2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, PriorityBadge } from "@/components/tickets/ticket-badges";
import type { Ticket } from "@/types/ticket";

interface TicketListTableProps {
  tickets: Ticket[];
  /** Show the requester column (admin/agent views). */
  showRequester?: boolean;
  /** Hide the "Solved by" column (rarely useful — on by default). */
  hideSolvedBy?: boolean;
}

/**
 * Ticket table used by every list view (customer, agent, admin).
 * Desktop gets a real table; on small screens rows restack as cards
 * (same DOM, responsive CSS). The "Solved by" column shows who moved
 * the ticket to resolved/closed and when.
 */
export function TicketListTable({
  tickets,
  showRequester = false,
  hideSolvedBy = false,
}: TicketListTableProps) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-28">Priority</TableHead>
              {showRequester && <TableHead className="w-40">Requester</TableHead>}
              <TableHead className="w-40">Assignee</TableHead>
              {!hideSolvedBy && <TableHead className="w-40">Solved by</TableHead>}
              <TableHead className="w-32 text-right">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell className="max-w-xs">
                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="block font-medium text-foreground transition-colors hover:text-primary"
                  >
                    <span className="line-clamp-1">{ticket.subject}</span>
                  </Link>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    #{ticket.ticket_number ?? ticket.id.slice(-6)}
                    {ticket.category && <> · {ticket.category.name}</>}
                    {typeof ticket.message_count === "number" && (
                      <> · {ticket.message_count} message{ticket.message_count === 1 ? "" : "s"}</>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={ticket.status} />
                </TableCell>
                <TableCell>
                  <PriorityBadge priority={ticket.priority} />
                </TableCell>
                {showRequester && (
                  <TableCell className="text-sm text-muted-foreground">
                    {ticket.requester?.name || ticket.requester?.email || "—"}
                  </TableCell>
                )}
                <TableCell className="text-sm text-muted-foreground">
                  {ticket.assignee ? (
                    <span className="flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      <span className="truncate">
                        {ticket.assignee.name || ticket.assignee.email}
                      </span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-muted-foreground/70">
                      <CircleUser className="h-3.5 w-3.5" aria-hidden="true" />
                      Unassigned
                    </span>
                  )}
                </TableCell>
                {!hideSolvedBy && (
                  <TableCell className="text-sm">
                    {ticket.resolved_by ? (
                      <span className="flex items-start gap-1.5">
                        <CheckCircle2
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-foreground">
                            {ticket.resolved_by.name || ticket.resolved_by.email}
                          </span>
                          {ticket.resolved_at && (
                            <span className="block text-xs text-muted-foreground">
                              {format(new Date(ticket.resolved_at), "MMM d, yyyy")}
                            </span>
                          )}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/70">—</span>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="space-y-3 md:hidden">
        {tickets.map((ticket) => (
          <Link
            key={ticket.id}
            href={`/tickets/${ticket.id}`}
            className="block rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="line-clamp-2 text-sm font-medium">{ticket.subject}</p>
              <span className="shrink-0 text-xs text-muted-foreground">
                #{ticket.ticket_number ?? ticket.id.slice(-6)}
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              {ticket.category && (
                <span className="text-xs text-muted-foreground">{ticket.category.name}</span>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {ticket.assignee
                  ? `Assigned: ${ticket.assignee.name || ticket.assignee.email}`
                  : "Unassigned"}
              </span>
              <span>
                {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })}
              </span>
            </div>
            {ticket.resolved_by && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="truncate">
                  Solved by {ticket.resolved_by.name || ticket.resolved_by.email}
                  {ticket.resolved_at && (
                    <> · {format(new Date(ticket.resolved_at), "MMM d, yyyy")}</>
                  )}
                </span>
              </div>
            )}
          </Link>
        ))}
      </div>
    </>
  );
}
