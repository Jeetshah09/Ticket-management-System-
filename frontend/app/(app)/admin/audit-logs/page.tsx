"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ScrollText, Shield } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { auditLogs as auditApi } from "@/services";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Read-only audit log viewer (admin). Data comes from
 * GET /audit-logs — if the backend doesn't implement it (404) or
 * denies access (403), the error state explains that honestly.
 */
export default function AuditLogsPage() {
  const [page, setPage] = useState(1);

  const list = useApi(
    () => auditApi.listAuditLogs({ page, page_size: 20 }),
    [page]
  );

  const items = list.data?.items ?? [];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Audit logs"
        description="Security and administrative actions recorded by the system."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Administration" },
          { label: "Audit logs" },
        ]}
        actions={
          <Badge variant="outline" className="gap-1.5 ring-1 ring-inset">
            <Shield className="h-3.5 w-3.5" aria-hidden="true" />
            Admin only
          </Badge>
        }
      />

      {list.loading && <TableSkeleton rows={8} />}
      {!list.loading && list.error && (
        <ErrorState
          error={list.error}
          onRetry={list.reload}
          title="Could not load audit logs"
        />
      )}

      {!list.loading && !list.error && (
        <div className="rounded-xl border bg-card shadow-sm">
          {items.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={ScrollText}
                title="No audit entries"
                description="Actions such as role changes, assignments, and status updates will be recorded here."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead className="w-40">Entity</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="w-40 text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[11px]">
                        {entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.actor ? (
                        <>
                          <span className="font-medium">
                            {entry.actor.name || entry.actor.email}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {entry.actor.email}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">System</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.entity_type ?? "—"}
                      {entry.entity_id && (
                        <span className="block font-mono">#{entry.entity_id.slice(-8)}</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {entry.details ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(entry.created_at), "MMM d, yyyy HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="px-4">
            <Pagination
              page={list.data?.page ?? 1}
              pages={list.data?.pages ?? 1}
              total={list.data?.total ?? 0}
              pageSize={list.data?.page_size ?? 20}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
