"use client";

import { Suspense, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Lock, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { TableSkeleton } from "@/components/shared/skeletons";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { resetPassword } from "@/services/auth";

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password is too long."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type ResetValues = z.infer<typeof resetSchema>;

function ResetPasswordForm() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token ?? "";
  const [isDone, setIsDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: ResetValues) => {
    setLoading(true);
    try {
      await resetPassword({ token, password: values.password });
      setIsDone(true);
      toast.success("Your password has been reset. You can now sign in.");
    } catch (error: unknown) {
      const detail =
        typeof error === "object" && error !== null && "detail" in error
          ? String((error as { detail: unknown }).detail)
          : "Could not reset your password. The link may have expired.";
      setError("confirmPassword", {
        type: "manual",
        message: detail,
      });
    } finally {
      setLoading(false);
    }
  };

  if (isDone) {
    return (
      <AuthShell
        title="Password reset"
        subtitle="Your password has been updated successfully."
        footer={
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in now
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
            <CheckCircle className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="text-sm text-muted-foreground">
            You can now sign in with your new password.
          </p>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Your reset link is valid for 60 minutes."
      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">
          ← Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField label="New password" htmlFor="password" required error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            invalid={!!errors.password}
            {...register("password")}
          />
        </FormField>

        <FormField
          label="Confirm password"
          htmlFor="confirmPassword"
          required
          error={errors.confirmPassword?.message}
        >
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            invalid={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
        </FormField>

        <Button type="submit" className="w-full" loading={loading || isSubmitting}>
          <Lock className="mr-2 h-4 w-4" aria-hidden="true" />
          Reset password
        </Button>

        {token && (
          <p className="text-center text-xs text-muted-foreground">
            Thanks for confirming. Use your new password to sign in.
          </p>
        )}
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={4} />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
