"use client";

import { use, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Layers,
  MessageSquare,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useApi } from "@/hooks/use-api";
import { tickets as ticketsApi } from "@/services";
import { PageHeader } from "@/components/shared/page-header";
import { DetailSkeleton } from "@/components/shared/skeletons";
import { ErrorState } from "@/components/shared/error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge, PriorityBadge } from "@/components/tickets/ticket-badges";
import { Conversation } from "@/components/tickets/conversation";
import { ReplyForm } from "@/components/tickets/reply-form";
import { TicketActions } from "@/components/tickets/ticket-actions";
import { ROLE_META } from "@/lib/constants";
import type { Ticket, TicketDetail } from "@/types/ticket";

/**
 * Ticket detail: metadata sidebar, conversation thread, reply composer,
 * and (for agents/admins) workflow controls. Everything renders from
 * GET /tickets/{id}; failures show a retry state instead of stub data.
 */
export default function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const [override, setOverride] = useState<TicketDetail | null>(null);

  const { data, loading, error, reload } = useApi(
    () => ticketsApi.getTicket(id),
    [id]
  );

  const ticket = override ?? data;

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Ticket"
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Tickets", href: "/tickets" },
            { label: "Details" },
          ]}
        />
        <DetailSkeleton />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div>
        <PageHeader
          title="Ticket"
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Tickets", href: "/tickets" },
            { label: "Details" },
          ]}
        />
        <ErrorState error={error} onRetry={reload} title="Could not load this ticket" />
        <div className="mt-4">
          <Link
            href="/tickets"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to tickets
          </Link>
        </div>
      </div>
    );
  }

  const messages = ticket.messages ?? [];

  const handleTicketUpdate = (updated: Ticket) => {
    setOverride((prev) => ({
      ...(prev ?? (ticket as TicketDetail)),
      ...updated,
      messages: prev?.messages ?? messages,
    }));
  };

  const handleConversationUpdate = (updated: TicketDetail) => {
    setOverride((prev) => ({ ...(prev ?? ticket), ...updated }));
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={ticket.subject}
        description={`Ticket #${ticket.ticket_number ?? ticket.id.slice(-6)}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Tickets", href: "/tickets" },
          { label: `#${ticket.ticket_number ?? ticket.id.slice(-6)}` },
        ]}
        actions={
          <Link
            href="/tickets"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to list
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Main column */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                {ticket.category && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    <Layers className="h-3 w-3" aria-hidden="true" />
                    {ticket.category.name}
                  </span>
                )}
              </div>
              <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed">
                {ticket.description}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="h-4 w-4 text-primary" aria-hidden="true" />
                Conversation
                <span className="font-normal text-muted-foreground">
                  ({messages.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <Conversation messages={messages} />
              <Separator />
              <ReplyForm
                ticket={ticket}
                user={user}
                onSent={handleConversationUpdate}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <TicketActions
            ticket={ticket}
            user={user}
            onChanged={handleTicketUpdate}
          />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 text-sm">
              <DetailRow
                icon={UserCheck}
                label="Requester"
                value={
                  ticket.requester
                    ? `${ticket.requester.name || ticket.requester.email}${
                        ticket.requester.role
                          ? ` (${ROLE_META[ticket.requester.role]?.label ?? ticket.requester.role})`
                          : ""
                      }`
                    : "—"
                }
              />
              <DetailRow
                icon={UserCheck}
                label="Assignee"
                value={
                  ticket.assignee
                    ? ticket.assignee.name || ticket.assignee.email
                    : "Unassigned"
                }
              />
              {ticket.resolved_by && (
                <DetailRow
                  icon={CheckCircle2}
                  label="Solved by"
                  value={`${ticket.resolved_by.name || ticket.resolved_by.email}${
                    ticket.resolved_at
                      ? ` · ${format(new Date(ticket.resolved_at), "MMM d, yyyy")}`
                      : ""
                  }`}
                />
              )}
              <DetailRow
                icon={CalendarClock}
                label="Created"
                value={format(new Date(ticket.created_at), "MMM d, yyyy h:mm a")}
              />
              <DetailRow
                icon={CalendarClock}
                label="Last updated"
                value={format(new Date(ticket.updated_at), "MMM d, yyyy h:mm a")}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-medium">{value}</p>
      </div>
    </div>
  );
}
