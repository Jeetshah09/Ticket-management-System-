"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { categories as categoriesApi, tickets as ticketsApi } from "@/services";
import { PageHeader } from "@/components/shared/page-header";
import { FormField } from "@/components/shared/form-field";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { applyFieldErrors, toApiError } from "@/lib/api-error";
import { PRIORITY_META } from "@/lib/constants";
import { TICKET_PRIORITIES } from "@/types/ticket";

/**
 * Create-ticket form. Categories are loaded from the backend; the form
 * cannot be submitted until they load (a ticket needs a real category).
 */
const createTicketSchema = z.object({
  subject: z.string().trim().min(5, "Subject must be at least 5 characters.").max(200, "Subject is too long."),
  category_id: z.string().min(1, "Choose a category."),
  priority: z.enum(TICKET_PRIORITIES, { message: "Choose a priority." }),
  description: z
    .string()
    .trim()
    .min(20, "Describe the issue in at least 20 characters.")
    .max(5000, "Description is too long."),
});

type CreateTicketValues = z.infer<typeof createTicketSchema>;

export default function NewTicketPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const categoryList = useApi(() => categoriesApi.listActiveCategories(), []);
  const categories = categoryList.data ?? [];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateTicketValues>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: { subject: "", category_id: "", priority: "medium", description: "" },
    mode: "onBlur",
  });

  const priority = watch("priority");
  const categoryId = watch("category_id");

  const onSubmit = async (values: CreateTicketValues) => {
    setSubmitError(null);
    try {
      const ticket = await ticketsApi.createTicket({
        subject: values.subject,
        description: values.description,
        category_id: values.category_id,
        priority: values.priority,
      });
      toast.success("Ticket created");
      router.push(`/tickets/${ticket.id}`);
      router.refresh();
    } catch (error) {
      const err = toApiError(error);
      const fieldNames = applyFieldErrors<CreateTicketValues>(error, setError);
      if (fieldNames.length === 0) setSubmitError(err.message);
      toast.error(err.message);
    }
  };

  return (
    <div className="animate-fade-in-up max-w-2xl">
      <PageHeader
        title="New ticket"
        description="Describe your issue and we'll route it to the right team."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "My Tickets", href: "/tickets" },
          { label: "New ticket" },
        ]}
      />

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        {categoryList.loading && (
          <div role="status" className="py-8 text-center text-sm text-muted-foreground">
            Loading form options…
          </div>
        )}

        {!categoryList.loading && categoryList.error && (
          <ErrorState
            error={categoryList.error}
            onRetry={categoryList.reload}
            title="Could not load categories"
          />
        )}

        {!categoryList.loading && !categoryList.error && (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {submitError && (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
              >
                {submitError}
              </div>
            )}

            <FormField label="Subject" htmlFor="subject" required error={errors.subject?.message}>
              <Input
                id="subject"
                placeholder="Brief summary of the issue"
                invalid={!!errors.subject}
                {...register("subject")}
              />
            </FormField>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                label="Category"
                required
                error={errors.category_id?.message}
              >
                <Select
                  value={categoryId || undefined}
                  onValueChange={(v) => setValue("category_id", v, { shouldValidate: true })}
                >
                  <SelectTrigger
                    className="w-full"
                    invalid={!!errors.category_id}
                    aria-label="Category"
                  >
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Priority" required error={errors.priority?.message}>
                <Select
                  value={priority}
                  onValueChange={(v) =>
                    setValue("priority", v as CreateTicketValues["priority"], {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger className="w-full" aria-label="Priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_META[p].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <FormField
              label="Description"
              htmlFor="description"
              required
              error={errors.description?.message}
              hint="Include steps to reproduce, expected behavior, and any error messages. Minimum 20 characters."
            >
              <Textarea
                id="description"
                rows={7}
                placeholder="What happened, and what did you expect instead?"
                invalid={!!errors.description}
                {...register("description")}
              />
            </FormField>

            <div className="flex items-center justify-end gap-3 border-t pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/tickets")}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {!isSubmitting && <Send aria-hidden="true" />}
                {isSubmitting ? "Submitting…" : "Submit ticket"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
