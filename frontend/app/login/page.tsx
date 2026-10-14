"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { LogIn, Mail } from "lucide-react";
import { TableSkeleton } from "@/components/shared/skeletons";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { useAuth } from "@/contexts/auth-context";
import { applyFieldErrors, toApiError } from "@/lib/api-error";
import { landingPathFor } from "@/lib/permissions";
import { forgotPassword } from "@/services/auth";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type LoginValues = z.infer<typeof loginSchema>;

function LoginForm() {
  const { login, status, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  const forcedNext = nextParam && nextParam.startsWith("/") ? nextParam : null;

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(forcedNext ?? landingPathFor(user?.role ?? "customer"));
    }
  }, [status, user, router, forcedNext]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginValues) => {
    setSubmitError(null);
    try {
      const signedIn = await login(values);
      toast.success(`Welcome back${signedIn.name ? `, ${signedIn.name}` : ""}`);
      router.replace(forcedNext ?? landingPathFor(signedIn.role));
      router.refresh();
    } catch (error) {
      const err = toApiError(error);
      const fieldNames = applyFieldErrors<LoginValues>(error, setError);
      if (err.status === 401) {
        setSubmitError("Incorrect email or password.");
      } else if (fieldNames.length === 0) {
        setSubmitError(err.message);
      }
    }
  };

  const handleForgotPassword = async (email: string) => {
    if (!email.trim()) return;
    setForgotLoading(true);
    try {
      await forgotPassword({ email: email.trim() });
      toast.success("If that email exists, we've sent a reset link.");
      router.push("/forgot-password?email=" + encodeURIComponent(email.trim()));
    } catch (error) {
      toast.error("Could not request a reset. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Use your account to access the ticket system."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {submitError && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
          >
            {submitError}
          </div>
        )}

        <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            invalid={!!errors.email}
            {...register("email")}
          />
        </FormField>

        <FormField label="Password" htmlFor="password" required error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            invalid={!!errors.password}
            {...register("password")}
          />
        </FormField>

        <Button type="submit" className="w-full" loading={isSubmitting}>
          {!isSubmitting && <LogIn aria-hidden="true" />}
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>

        <div className="text-center text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => handleForgotPassword(register("email").getValue?.() ?? "")}
            disabled={forgotLoading}
            className="inline-flex items-center gap-1.5 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {forgotLoading ? (
              "Sending…"
            ) : (
              <>
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                Forgot your password?
              </>
            )}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={4} />}>
      <LoginForm />
    </Suspense>
  );
}
