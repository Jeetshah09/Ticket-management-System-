"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Headset, ShieldCheck, User, UserPlus, type LucideIcon } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { useAuth } from "@/contexts/auth-context";
import { applyFieldErrors, toApiError } from "@/lib/api-error";
import { landingPathFor } from "@/lib/permissions";
import type { Role } from "@/types/auth";

/**
 * Self-service registration for all three roles. The backend assigns the
 * role from this payload (defaulting to "customer"); an ADMIN account
 * additionally requires the invite code configured as ADMIN_INVITE_CODE,
 * so public registration never yields an admin by accident.
 */
const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters."),
    email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(128, "Password is too long."),
    confirmPassword: z.string().min(1, "Confirm your password."),
    role: z.enum(["customer", "agent", "admin"]),
    invite_code: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .superRefine((v, ctx) => {
    if (v.role === "admin" && !v.invite_code) {
      ctx.addIssue({
        code: "custom",
        path: ["invite_code"],
        message: "An admin invite code is required.",
      });
    }
  });

type RegisterValues = z.infer<typeof registerSchema>;

const ROLE_CHOICES: { value: Role; label: string; icon: LucideIcon; blurb: string }[] = [
  {
    value: "customer",
    label: "Customer",
    icon: User,
    blurb: "Submit and track your own support tickets.",
  },
  {
    value: "agent",
    label: "Agent",
    icon: Headset,
    blurb: "Work the shared queue, reply, and resolve tickets.",
  },
  {
    value: "admin",
    label: "Admin",
    icon: ShieldCheck,
    blurb: "Manage users, categories, analytics, and audit logs.",
  },
];

export default function RegisterPage() {
  const { register: registerUser, status, user } = useAuth();
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(landingPathFor(user?.role ?? "customer"));
    }
  }, [status, user, router]);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "customer",
      invite_code: "",
    },
  });

  const selectedRole = watch("role");

  const onSubmit = async (values: RegisterValues) => {
    setSubmitError(null);
    try {
      const created = await registerUser({
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role,
        ...(values.role === "admin" && values.invite_code
          ? { invite_code: values.invite_code }
          : {}),
      });
      toast.success(
        values.role === "customer"
          ? "Account created — welcome!"
          : `Your ${values.role} account is ready.`
      );
      router.replace(landingPathFor(created.role));
      router.refresh();
    } catch (error) {
      // Backend created the account but didn't auto-login.
      if (error instanceof Error && error.name === "AccountCreatedError") {
        toast.success("Account created. Please sign in.");
        router.replace("/login");
        return;
      }
      const err = toApiError(error);
      const fieldNames = applyFieldErrors<RegisterValues>(error, setError);
      if (fieldNames.length === 0) {
        setSubmitError(err.message);
      }
    }
  };

  const selected = ROLE_CHOICES.find((r) => r.value === selectedRole) ?? ROLE_CHOICES[0];

  return (
    <AuthShell
      title="Create your account"
      subtitle="Register as a customer, agent, or admin. Admin accounts require an invite code from your administrator."
      footer={
        <>
          Already registered?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
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

        <FormField
          label="Account type"
          htmlFor="role"
          required
          error={errors.role?.message}
          hint={selected.blurb}
        >
          <div
            role="radiogroup"
            aria-label="Account type"
            className="grid grid-cols-3 gap-2"
          >
            {ROLE_CHOICES.map((choice) => (
              <label
                key={choice.value}
                className="relative cursor-pointer rounded-lg border bg-card p-2.5 text-center transition-colors hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  id={`role-${choice.value}`}
                  type="radio"
                  value={choice.value}
                  className="peer sr-only"
                  aria-label={choice.label}
                  {...register("role")}
                />
                <span className="pointer-events-none flex flex-col items-center gap-1 text-muted-foreground peer-checked:text-primary">
                  <choice.icon className="h-4 w-4" aria-hidden="true" />
                  <span className="text-xs font-medium">{choice.label}</span>
                </span>
              </label>
            ))}
          </div>
        </FormField>

        {selectedRole === "admin" && (
          <FormField
            label="Admin invite code"
            htmlFor="invite_code"
            required
            error={errors.invite_code?.message}
            hint="Provided by your administrator (ADMIN_INVITE_CODE)."
          >
            <Input
              id="invite_code"
              type="text"
              autoComplete="off"
              placeholder="Enter invite code"
              invalid={!!errors.invite_code}
              {...register("invite_code")}
            />
          </FormField>
        )}

        <FormField label="Full name" htmlFor="name" required error={errors.name?.message}>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Jane Doe"
            invalid={!!errors.name}
            {...register("name")}
          />
        </FormField>

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

        <FormField
          label="Password"
          htmlFor="password"
          required
          error={errors.password?.message}
          hint="At least 8 characters."
        >
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

        <Button type="submit" className="w-full" loading={isSubmitting}>
          {!isSubmitting && <UserPlus aria-hidden="true" />}
          {isSubmitting ? "Creating account…" : `Create ${selected.label.toLowerCase()} account`}
        </Button>
      </form>
    </AuthShell>
  );
}
