"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { TableSkeleton } from "@/components/shared/skeletons";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { forgotPassword } from "@/services/auth";

const forgotSchema = z.object({
  email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
});

type ForgotValues = z.infer<typeof forgotSchema>;

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";
  const [isDone, setIsDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: initialEmail },
  });

  const onSubmit = async (values: ForgotValues) => {
    setLoading(true);
    setIsDone(false);
    try {
      await forgotPassword(values);
      setIsDone(true);
      toast.success("If that email exists, we've sent a reset link.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (isDone) {
    return (
      <AuthShell
        title="Check your email"
        subtitle="If an account exists for that email, we sent a password-reset link."
        footer={
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
            <CheckCircle className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="text-sm text-muted-foreground">
            Didn&apos;t receive anything? Check your spam folder, or{" "}
            <button
              type="button"
              onClick={() => setIsDone(false)}
              className="font-medium text-primary hover:underline"
            >
              try a different email
            </button>
            .
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
      title="Reset your password"
      subtitle="Enter the email address for your account and we&apos;ll send you a reset link."
      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">
          ← Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField label="Email address" htmlFor="email" required error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            defaultValue={initialEmail}
            invalid={!!errors.email}
            {...register("email")}
          />
        </FormField>

        <Button type="submit" className="w-full" loading={loading || isSubmitting}>
          <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
          Send reset link
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          We&apos;ll email you a secure link to choose a new password. The link expires in 60 minutes.
        </p>
      </form>
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={4} />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
