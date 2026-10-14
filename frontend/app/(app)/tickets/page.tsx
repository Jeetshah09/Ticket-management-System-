"use client";

import { Suspense, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PlusCircle, Ticket } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useApi } from "@/hooks/use-api";
import { categories as categoriesApi, tickets as ticketsApi } from "@/services";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { TicketListSkeleton } from "@/components/shared/skeletons";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  TicketFilters,
  DEFAULT_FILTERS,
  type TicketFilterValues,
} from "@/components/tickets/ticket-filters";
import { TicketListTable } from "@/components/tickets/ticket-list-table";
import type { TicketListParams } from "@/types/ticket";

const SORT_MAP: Record<string, { sort_by: TicketListParams["sort_by"]; sort_order: "asc" | "desc" }> = {
  updated_desc: { sort_by: "updated_at", sort_order: "desc" },
  created_desc: { sort_by: "created_at", sort_order: "desc" },
  created_asc: { sort_by: "created_at", sort_order: "asc" },
  priority_desc: { sort_by: "priority", sort_order: "desc" },
  status_asc: { sort_by: "status", sort_order: "asc" },
};

function TicketsPageInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = user?.role ?? "customer";
  const isCustomer = role === "customer";

  const filters: TicketFilterValues = useMemo(
    () => ({
      search: searchParams.get("q") ?? DEFAULT_FILTERS.search,
      status: searchParams.get("status") ?? DEFAULT_FILTERS.status,
      priority: searchParams.get("priority") ?? DEFAULT_FILTERS.priority,
      category_id: searchParams.get("category") ?? DEFAULT_FILTERS.category_id,
      assignee: searchParams.get("assignee") ?? DEFAULT_FILTERS.assignee,
      sort: searchParams.get("sort") ?? DEFAULT_FILTERS.sort,
    }),
    [searchParams]
  );
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);

  const setFilters = useCallback(
    (next: TicketFilterValues) => {
      const params = new URLSearchParams(searchParams.toString());
      const toggle = (key: string, value: string, fallback: string) => {
        if (value === fallback) params.delete(key);
        else params.set(key, value);
      };
      toggle("q", next.search, DEFAULT_FILTERS.search);
      toggle("status", next.status, DEFAULT_FILTERS.status);
      toggle("priority", next.priority, DEFAULT_FILTERS.priority);
      toggle("category", next.category_id, DEFAULT_FILTERS.category_id);
      toggle("assignee", next.assignee, DEFAULT_FILTERS.assignee);
      toggle("sort", next.sort, DEFAULT_FILTERS.sort);
      params.delete("page");
      router.replace(`/tickets?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const setPage = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextPage <= 1) params.delete("page");
      else params.set("page", String(nextPage));
      router.replace(`/tickets?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const listParams: TicketListParams = useMemo(() => {
    const sort = SORT_MAP[filters.sort] ?? SORT_MAP.updated_desc;
    const assigneeId =
      filters.assignee === "me"
        ? "me"
        : filters.assignee === "unassigned"
          ? "unassigned"
          : filters.assignee !== "all"
            ? filters.assignee
            : undefined;
    return {
      page,
      page_size: 10,
      search: filters.search.trim() || undefined,
      status: filters.status === "all" ? "" : (filters.status as TicketListParams["status"]),
      priority: filters.priority === "all" ? "" : (filters.priority as TicketListParams["priority"]),
      category_id: filters.category_id === "all" ? undefined : filters.category_id,
      assignee_id: assigneeId,
      ...sort,
    };
  }, [filters, page]);

  const list = useApi(
    () => ticketsApi.listTickets(listParams),
    [
      listParams.search,
      listParams.status,
      listParams.priority,
      listParams.category_id,
      listParams.assignee_id,
      listParams.sort_by,
      listParams.sort_order,
      page,
      role,
    ]
  );

  const categoryList = useApi(
    () => categoriesApi.listActiveCategories(),
    []
  );

  const title = isCustomer
    ? "My Tickets"
    : role === "agent"
      ? "Ticket Queue"
      : "All Tickets";
  const description = isCustomer
    ? "All the support requests you have submitted."
    : role === "agent"
      ? "Tickets you can work on according to your queue permissions."
      : "Every ticket in the system, with full assignment controls.";

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: title }]}
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

      <div className="space-y-4">
        <TicketFilters
          values={filters}
          onChange={setFilters}
          categories={categoryList.data ?? []}
          showAssignee={!isCustomer}
        />

        {list.loading && <TicketListSkeleton rows={6} />}

        {!list.loading && list.error && (
          <ErrorState error={list.error} onRetry={list.reload} />
        )}

        {!list.loading && !list.error && list.data && (
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="p-4">
              {list.data.items.length === 0 ? (
                <EmptyState
                  icon={Ticket}
                  title={
                    filters.search || filters.status !== "all" || filters.priority !== "all"
                      ? "No tickets match your filters"
                      : isCustomer
                        ? "No tickets yet"
                        : "No tickets here"
                  }
                  description={
                    filters.search || filters.status !== "all" || filters.priority !== "all"
                      ? "Try adjusting or clearing the filters."
                      : isCustomer
                        ? "Submit a support request and it will show up in this list."
                        : "Tickets matching your permissions will appear here."
                  }
                  actionLabel={
                    filters.search ||
                    filters.status !== "all" ||
                    filters.priority !== "all"
                      ? "Clear filters"
                      : undefined
                  }
                  onAction={
                    filters.search ||
                    filters.status !== "all" ||
                    filters.priority !== "all"
                      ? () => setFilters(DEFAULT_FILTERS)
                      : undefined
                  }
                />
              ) : (
                <TicketListTable
                  tickets={list.data.items}
                  showRequester={!isCustomer}
                />
              )}
            </div>
            <div className="px-4">
              <Pagination
                page={list.data.page}
                pages={list.data.pages}
                total={list.data.total}
                pageSize={list.data.page_size}
                onPageChange={setPage}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TicketsPage() {
  return (
    <Suspense fallback={<TicketListSkeleton rows={6} />}>
      <TicketsPageInner />
    </Suspense>
  );
}
