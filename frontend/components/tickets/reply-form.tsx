"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { applyFieldErrors, toApiError } from "@/lib/api-error";
import { tickets as ticketsApi } from "@/services";
import { canAddInternalNote } from "@/lib/permissions";
import type { MessageVisibility, TicketDetail } from "@/types/ticket";
import type { User } from "@/types/auth";

const replySchema = z.object({
  body: z.string().trim().min(2, "Write a message before sending.").max(5000, "Message is too long."),
});

type ReplyValues = z.infer<typeof replySchema>;

interface ReplyFormProps {
  ticket: TicketDetail;
  user: User | null;
  onSent: (updated: TicketDetail) => void;
}

/**
 * Reply composer. Agents/admins can switch between a public reply and
 * an internal note; customers always send public replies. Submission
 * is locked while pending to prevent duplicates.
 */
export function ReplyForm({ ticket, user, onSent }: ReplyFormProps) {
  const [visibility, setVisibility] = useState<MessageVisibility>("public");
  const mayNote = canAddInternalNote(user);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReplyValues>({
    resolver: zodResolver(replySchema),
    defaultValues: { body: "" },
  });

  const onSubmit = async (values: ReplyValues) => {
    try {
      const updated = await ticketsApi.addMessage(ticket.id, {
        body: values.body,
        visibility: mayNote ? visibility : "public",
      });
      reset();
      toast.success(mayNote && visibility === "internal" ? "Internal note added" : "Reply sent");
      // Prefer merging the returned conversation; fall back to refetch signal.
      if (updated?.messages?.length) onSent(updated);
      else onSent({ ...ticket, messages: ticket.messages ?? [] });
    } catch (error) {
      const err = toApiError(error);
      applyFieldErrors<ReplyValues>(error, setError);
      toast.error(err.message);
    }
  };

  const internal = mayNote && visibility === "internal";

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Add to conversation</p>
        {mayNote && (
          <Tabs
            value={visibility}
            onValueChange={(v) => setVisibility(v as MessageVisibility)}
          >
            <TabsList className="h-8">
              <TabsTrigger value="public" className="h-6.5 px-3 text-xs">
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                Public reply
              </TabsTrigger>
              <TabsTrigger value="internal" className="h-6.5 px-3 text-xs">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                Internal note
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      <Textarea
        rows={4}
        placeholder={
          internal
            ? "Write a note for your team — the customer will not see this."
            : "Write your reply to the customer…"
        }
        aria-label={internal ? "Internal note" : "Public reply"}
        invalid={!!errors.body}
        disabled={isSubmitting}
        {...register("body")}
      />
      {errors.body && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {errors.body.message}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {internal
            ? "Internal notes are hidden from customers."
            : "Your reply will be visible to everyone on this ticket."}
        </p>
        <Button type="submit" loading={isSubmitting}>
          {!isSubmitting && <Send aria-hidden="true" />}
          {isSubmitting ? "Sending…" : internal ? "Add note" : "Send reply"}
        </Button>
      </div>
    </form>
  );
}
