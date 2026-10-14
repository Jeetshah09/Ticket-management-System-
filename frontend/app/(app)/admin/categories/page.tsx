"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { Layers, Pencil, PlusCircle, Power, PowerOff } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { categories as categoriesApi } from "@/services";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/skeletons";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { applyFieldErrors, toApiError } from "@/lib/api-error";
import type { Category } from "@/types/ticket";

const categorySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80, "Name is too long."),
  description: z.string().trim().max(300, "Description is too long.").optional(),
  is_active: z.boolean(),
});

type CategoryValues = z.infer<typeof categorySchema>;

/**
 * Admin category management: create, rename, and activate/deactivate.
 * Categories are never deleted (existing tickets reference them) — the
 * safe policy is deactivation, which keeps history intact.
 */
export default function AdminCategoriesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const list = useApi(
    () => categoriesApi.listCategories({ include_inactive: true, page_size: 100 }),
    [dialogOpen]
  );

  const {
    register,
    handleSubmit,
    setError,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", description: "", is_active: true },
  });

  const isActive = watch("is_active");

  const openCreate = () => {
    setEditing(null);
    reset({ name: "", description: "", is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    reset({
      name: category.name,
      description: category.description ?? "",
      is_active: category.is_active,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: CategoryValues) => {
    setSaving(true);
    try {
      const payload = {
        name: values.name,
        description: values.description?.trim() || undefined,
      };
      if (editing) {
        await categoriesApi.updateCategory(editing.id, {
          ...payload,
          is_active: Boolean(values.is_active),
        });
        toast.success("Category updated");
      } else {
        await categoriesApi.createCategory(payload);
        toast.success("Category created");
      }
      setDialogOpen(false);
      list.reload();
    } catch (error) {
      const err = toApiError(error);
      const fields = applyFieldErrors<CategoryValues>(error, setError);
      if (fields.length === 0) toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (category: Category) => {
    setTogglingId(category.id);
    try {
      await categoriesApi.updateCategory(category.id, {
        is_active: !category.is_active,
      });
      toast.success(
        category.is_active
          ? `"${category.name}" deactivated — existing tickets keep it`
          : `"${category.name}" activated`
      );
      list.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setTogglingId(null);
    }
  };

  const items = list.data?.items ?? [];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Categories"
        description="Organize tickets into routing categories. Deactivate instead of deleting to preserve history."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Administration" },
          { label: "Categories" },
        ]}
        actions={
          <Button onClick={openCreate}>
            <PlusCircle aria-hidden="true" /> New category
          </Button>
        }
      />

      {list.loading && <TableSkeleton rows={5} />}
      {!list.loading && list.error && (
        <ErrorState error={list.error} onRetry={list.reload} />
      )}

      {!list.loading && !list.error && (
        <div className="rounded-xl border bg-card shadow-sm">
          {items.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Layers}
                title="No categories yet"
                description="Create the first category so customers can route their tickets."
                actionLabel="Create category"
                onAction={openCreate}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-36">Created</TableHead>
                  <TableHead className="w-44 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <p className="font-medium">{category.name}</p>
                      {category.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {category.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {category.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {category.created_at
                        ? format(new Date(category.created_at), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => openEdit(category)}
                        >
                          <Pencil aria-hidden="true" /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          loading={togglingId === category.id}
                          onClick={() => void toggleActive(category)}
                        >
                          {category.is_active ? (
                            <>
                              <PowerOff aria-hidden="true" /> Deactivate
                            </>
                          ) : (
                            <>
                              <Power aria-hidden="true" /> Activate
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the category details or its active state."
                : "Categories help customers and agents route tickets."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <FormField label="Name" htmlFor="cat-name" required error={errors.name?.message}>
              <Input
                id="cat-name"
                placeholder="e.g. Billing"
                invalid={!!errors.name}
                disabled={isSubmitting || saving}
                {...register("name")}
              />
            </FormField>
            <FormField
              label="Description"
              htmlFor="cat-description"
              error={errors.description?.message}
              hint="Optional — shown to customers when picking a category."
            >
              <Textarea
                id="cat-description"
                rows={3}
                placeholder="What belongs in this category?"
                invalid={!!errors.description}
                disabled={isSubmitting || saving}
                {...register("description")}
              />
            </FormField>
            {editing && (
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
                  {...register("is_active")}
                />
                Active (customers can select this category)
                {!isActive && (
                  <span className="text-xs text-muted-foreground">(currently inactive)</span>
                )}
              </label>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                disabled={isSubmitting || saving}
              >
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting || saving}>
                {editing ? "Save changes" : "Create category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
