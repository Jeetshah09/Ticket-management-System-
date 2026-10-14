"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDot,
  Inbox,
  Layers,
  PlusCircle,
  Ticket,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useApi } from "@/hooks/use-api";
import { analytics, tickets as ticketsApi } from "@/services";
import { PageHeader } from "@/components/shared/page-header";
import { StatsSkeleton, TicketListSkeleton } from "@/components/shared/skeletons";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/dashboard/stat-card";
import { FadeIn } from "@/components/shared/fade-in";
import {
  PriorityChart,
  StatusChart,
  TrendChart,
  WorkloadChart,
} from "@/components/dashboard/charts";
import { TicketListTable } from "@/components/tickets/ticket-list-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_META } from "@/lib/constants";

/**
 * Role-aware dashboard. All numbers come from /analytics/overview and
 * /tickets — nothing is fabricated client-side. Each data region has
 * its own loading/error handling so one failure doesn't blank the page.
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role ?? "customer";
  const isAdmin = role === "admin";
  const isCustomer = role === "customer";

  const overview = useApi(() => analytics.getOverview(), [role]);
  const recent = useApi(
    () =>
      ticketsApi.listTickets({
        page: 1,
        page_size: 5,
        sort_by: "updated_at",
        sort_order: "desc",
      }),
    [role]
  );
  const workloads = useApi(
    async () => (isAdmin ? analytics.getAgentWorkloads() : []),
    [isAdmin]
  );

  const stats = overview.data;

  const statCards = stats
    ? [
        {
          label: isCustomer ? "My tickets" : "Total tickets",
          value: stats.total_tickets,
          icon: Ticket,
          tone: "primary" as const,
        },
        {
          label: "Open",
          value: stats.open_tickets,
          icon: CircleDot,
          tone: "warning" as const,
        },
        {
          label: "Resolved",
          value: stats.resolved_tickets ?? 0,
          icon: CheckCircle2,
          tone: "success" as const,
        },
        ...(isAdmin
          ? [
              {
                label: "Users",
                value: stats.total_users ?? 0,
                icon: Users,
                tone: "default" as const,
              },
              {
                label: "Categories",
                value: stats.total_categories ?? 0,
                icon: Layers,
                tone: "default" as const,
              },
              {
                label: "Unassigned",
                value: stats.unassigned_tickets ?? 0,
                icon: Inbox,
                tone: "warning" as const,
              },
            ]
          : []),
      ]
    : [];

  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={
          firstName ? `Welcome back, ${firstName}` : "Dashboard"
        }
        description={
          isCustomer
            ? "Track your support requests and replies in one place."
            : role === "agent"
              ? "Your assigned work, queue health, and recent activity."
              : "System-wide ticket, user, and category metrics."
        }
        breadcrumbs={[{ label: "Dashboard" }]}
        actions={
          isCustomer ? (
            <Button asChild>
              <Link href="/tickets/new">
                <PlusCircle aria-hidden="true" /> New ticket
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* Stats */}
      {overview.loading && <StatsSkeleton count={isAdmin ? 6 : 3} />}
      {!overview.loading && overview.error && (
        <ErrorState error={overview.error} onRetry={overview.reload} />
      )}
      {!overview.loading && !overview.error && stats && (
        <div
          className={`grid gap-4 ${isAdmin ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-3"}`}
        >
          {statCards.map((card, index) => (
            <FadeIn key={card.label} delay={index * 0.05} className="h-full">
              <StatCard {...card} />
            </FadeIn>
          ))}
        </div>
      )}

      {/* Charts */}
      {!overview.loading && !overview.error && stats && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
                Tickets by status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StatusChart data={stats.by_status ?? []} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
                Tickets by priority
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PriorityChart data={stats.by_priority ?? []} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Admin: agent workload */}
      {isAdmin && (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-primary" aria-hidden="true" />
              Agent workload
            </CardTitle>
          </CardHeader>
          <CardContent>
            {workloads.loading && <StatsSkeleton count={1} />}
            {!workloads.loading && workloads.error && (
              <ErrorState error={workloads.error} onRetry={workloads.reload} />
            )}
            {!workloads.loading && !workloads.error && (
              <WorkloadChart data={workloads.data ?? []} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent tickets */}
      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-semibold">
            {isCustomer ? "Your recent tickets" : "Recently updated tickets"}
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/tickets">
              View all <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recent.loading && <TicketListSkeleton rows={4} />}
          {!recent.loading && recent.error && (
            <ErrorState error={recent.error} onRetry={recent.reload} />
          )}
          {!recent.loading && !recent.error && recent.data && (
            <>
              {recent.data.items.length === 0 ? (
                <EmptyState
                  icon={Ticket}
                  title={isCustomer ? "No tickets yet" : "No tickets in the queue"}
                  description={
                    isCustomer
                      ? "When you submit a support request it will appear here."
                      : "Tickets matching your permissions will appear here."
                  }
                  actionLabel={isCustomer ? "Create your first ticket" : undefined}
                  onAction={
                    isCustomer
                      ? () => {
                          window.location.href = "/tickets/new";
                        }
                      : undefined
                  }
                />
              ) : (
                <TicketListTable
                  tickets={recent.data.items}
                  showRequester={!isCustomer}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Trend */}
      {!overview.loading && !overview.error && stats && (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Ticket creation trend
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {ROLE_META[role].label} view
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={stats.created_trend ?? []} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
