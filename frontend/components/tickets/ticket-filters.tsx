"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRIORITY_META, STATUS_META } from "@/lib/constants";
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/types/ticket";
import type { Category } from "@/types/ticket";

export interface TicketFilterValues {
  search: string;
  status: string;
  priority: string;
  category_id: string;
  assignee: string;
  sort: string;
}

export const DEFAULT_FILTERS: TicketFilterValues = {
  search: "",
  status: "all",
  priority: "all",
  category_id: "all",
  assignee: "all",
  sort: "updated_desc",
};

interface TicketFiltersProps {
  values: TicketFilterValues;
  onChange: (values: TicketFilterValues) => void;
  categories?: Category[];
  /** Assignee filter is only meaningful for agent/admin queues. */
  showAssignee?: boolean;
  onSubmitSearch?: () => void;
}

const ANY = "__any__";

/**
 * Filter bar: search + status/priority/category (+ assignee) selects.
 * Values are URL-backed by the page so views are shareable.
 */
export function TicketFilters({
  values,
  onChange,
  categories = [],
  showAssignee = false,
}: TicketFiltersProps) {
  const set = (patch: Partial<TicketFilterValues>) =>
    onChange({ ...values, ...patch });

  const activeCount = [
    values.status !== "all",
    values.priority !== "all",
    values.category_id !== "all",
    values.assignee !== "all",
    values.search.trim() !== "",
  ].filter(Boolean).length;

  const hasFilters = activeCount > 0;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search by subject, description, or ticket #…"
            className="pl-9"
            aria-label="Search tickets"
            value={values.search}
            onChange={(e) => set({ search: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={values.status}
            onValueChange={(v) => set({ status: v })}
          >
            <SelectTrigger className="w-[150px]" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any status</SelectItem>
              {TICKET_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={values.priority}
            onValueChange={(v) => set({ priority: v })}
          >
            <SelectTrigger className="w-[150px]" aria-label="Filter by priority">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any priority</SelectItem>
              {TICKET_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_META[p].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {categories.length > 0 && (
            <Select
              value={values.category_id}
              onValueChange={(v) => set({ category_id: v })}
            >
              <SelectTrigger className="w-[160px]" aria-label="Filter by category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any category</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {showAssignee && (
            <Select
              value={values.assignee}
              onValueChange={(v) => set({ assignee: v })}
            >
              <SelectTrigger className="w-[150px]" aria-label="Filter by assignee">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Anyone</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                <SelectItem value="me">Assigned to me</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Select
            value={values.sort}
            onValueChange={(v) => set({ sort: v })}
          >
            <SelectTrigger className="w-[170px]" aria-label="Sort tickets">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated_desc">Newest update</SelectItem>
              <SelectItem value="created_desc">Newest created</SelectItem>
              <SelectItem value="created_asc">Oldest created</SelectItem>
              <SelectItem value="priority_desc">Priority (high→low)</SelectItem>
              <SelectItem value="status_asc">Status</SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...DEFAULT_FILTERS })}
              aria-label="Clear all filters"
            >
              <X aria-hidden="true" /> Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
