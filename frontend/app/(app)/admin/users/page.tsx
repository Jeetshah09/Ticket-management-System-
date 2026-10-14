"use client";

import { useCallback, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Search, ShieldCheck, Users as UsersIcon, UserX } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/contexts/auth-context";
import { users as usersApi } from "@/services";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ROLE_META, ROLE_OPTIONS } from "@/lib/constants";
import type { Role, User } from "@/types/auth";

/**
 * Admin user management: search, role/status inspection, and updates
 * via PATCH /users/{id}. Changes go through a confirmation dialog
 * because role changes affect access immediately.
 */
function UsersPageInner() {
  const { user: currentUser } = useAuth();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [updating, setUpdating] = useState(false);
  const [pending, setPending] = useState<{
    user: User;
    patch: { role?: Role; is_active?: boolean };
  } | null>(null);

  const params = useMemo(
    () => ({
      page,
      page_size: 10,
      search: query.trim() || undefined,
      role: roleFilter === "all" ? undefined : roleFilter,
    }),
    [page, query, roleFilter]
  );

  const list = useApi(
    () => usersApi.listUsers(params),
    [params.page, params.search, params.role]
  );

  const update = async (u: User, patch: { role?: Role; is_active?: boolean }) => {
    setUpdating(true);
    try {
      await usersApi.updateUser(u.id, patch);
      toast.success(
        patch.role
          ? `${u.name || u.email} is now ${ROLE_META[patch.role].label}`
          : patch.is_active === false
            ? `${u.name || u.email} deactivated`
            : `${u.name || u.email} reactivated`
      );
      setPending(null);
      list.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  const onSearch = useCallback(
    (value: string) => {
      setQuery(value);
      setPage(1);
    },
    []
  );

  const items = list.data?.items ?? [];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="User management"
        description="Search accounts, inspect roles, and update access."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Administration" },
          { label: "Users" },
        ]}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search by name or email…"
            className="pl-9"
            aria-label="Search users"
            value={query}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(v) => {
            setRoleFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ROLE_OPTIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {list.loading && <TableSkeleton rows={6} />}
      {!list.loading && list.error && <ErrorState error={list.error} onRetry={list.reload} />}

      {!list.loading && !list.error && (
        <div className="rounded-xl border bg-card shadow-sm">
          {items.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={UsersIcon}
                title="No users found"
                description="Try a different search term or role filter."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="w-32">Role</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-36">Joined</TableHead>
                  <TableHead className="w-40 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <p className="font-medium">{u.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className="ring-1 ring-inset"
                          variant="outline"
                        >
                          {ROLE_META[u.role]?.label ?? u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.is_active === false ? (
                          <Badge variant="destructive">Inactive</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.created_at
                          ? format(new Date(u.created_at), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1.5">
                          {ROLE_OPTIONS.map((option) => {
                            if (option.value === u.role) return null;
                            return (
                              <Button
                                key={option.value}
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={isSelf}
                                title={
                                  isSelf
                                    ? "You cannot change your own role"
                                    : `Change role to ${option.label}`
                                }
                                onClick={() =>
                                  setPending({
                                    user: u,
                                    patch: { role: option.value },
                                  })
                                }
                              >
                                <ShieldCheck aria-hidden="true" />
                                {option.label}
                              </Button>
                            );
                          })}
                          {u.is_active !== false ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              disabled={isSelf}
                              title={
                                isSelf ? "You cannot deactivate yourself" : "Deactivate account"
                              }
                              onClick={() =>
                                setPending({ user: u, patch: { is_active: false } })
                              }
                            >
                              <UserX aria-hidden="true" /> Deactivate
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={isSelf}
                              onClick={() =>
                                setPending({ user: u, patch: { is_active: true } })
                              }
                            >
                              Activate
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <div className="px-4">
            <Pagination
              page={list.data?.page ?? 1}
              pages={list.data?.pages ?? 1}
              total={list.data?.total ?? 0}
              pageSize={list.data?.page_size ?? 10}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      {/* Confirmation dialog — role/status changes affect access, so confirm first */}
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm account change</DialogTitle>
            <DialogDescription>
              {pending?.patch.role
                ? `Change ${pending.user.name || pending.user.email} from ${
                    ROLE_META[pending.user.role]?.label ?? pending.user.role
                  } to ${ROLE_META[pending.patch.role].label}? Their access to tickets and tools changes immediately.`
                : pending?.patch.is_active === false
                  ? `Deactivate ${pending.user.name || pending.user.email}? They will no longer be able to sign in.`
                  : `Reactivate ${pending?.user.name || pending?.user.email}? They will be able to sign in again.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              variant={pending?.patch.is_active === false ? "destructive" : "default"}
              loading={updating}
              onClick={() => {
                if (!pending) return;
                void update(pending.user, pending.patch);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminUsersPage() {
  return <UsersPageInner />;
}
