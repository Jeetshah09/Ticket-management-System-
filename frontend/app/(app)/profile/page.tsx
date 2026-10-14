"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { BadgeCheck, Save, Shield } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { auth as authService } from "@/services";
import { PageHeader } from "@/components/shared/page-header";
import { FormField } from "@/components/shared/form-field";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { applyFieldErrors, toApiError } from "@/lib/api-error";
import { ROLE_META } from "@/lib/constants";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120, "Name is too long."),
  email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
});

type ProfileValues = z.infer<typeof profileSchema>;

function initials(name: string, email: string): string {
  const source = (name || email).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (source.slice(0, 2) || "?").toUpperCase();
}

/**
 * Profile / settings. Edits name and email via PATCH /auth/me.
 * Password change is intentionally absent — the backend contract does
 * not define a password-change endpoint, and we don't advertise flows
 * that don't exist.
 */
export default function ProfilePage() {
  const { user, setUser, sessionError, refresh } = useAuth();

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: {
      name: user?.name ?? "",
      email: user?.email ?? "",
    },
    defaultValues: { name: "", email: "" },
  });

  useEffect(() => {
    if (user) reset({ name: user.name, email: user.email });
  }, [user, reset]);

  const onSubmit = async (values: ProfileValues) => {
    try {
      const updated = await authService.updateProfile(values);
      const merged = { ...(user ?? updated), ...updated };
      setUser(merged);
      reset({ name: merged.name, email: merged.email });
      toast.success("Profile updated");
    } catch (error) {
      const err = toApiError(error);
      const fieldNames = applyFieldErrors<ProfileValues>(error, setError);
      if (fieldNames.length === 0) toast.error(err.message);
    }
  };

  if (!user) {
    return <ErrorState error={new Error(sessionError ?? "Session unavailable")} onRetry={refresh} />;
  }

  const roleMeta = ROLE_META[user.role];

  return (
    <div className="animate-fade-in-up max-w-3xl">
      <PageHeader
        title="Profile & settings"
        description="Manage your account details."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Profile" }]}
      />

      <div className="grid gap-4 sm:grid-cols-[280px_1fr]">
        {/* Identity card */}
        <Card className="h-fit">
          <CardContent className="flex flex-col items-center p-6 text-center">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">
                {initials(user.name, user.email)}
              </AvatarFallback>
            </Avatar>
            <h2 className="mt-4 text-base font-semibold">{user.name || "—"}</h2>
            <p className="mt-0.5 break-all text-sm text-muted-foreground">{user.email}</p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/25">
              <Shield className="h-3.5 w-3.5" aria-hidden="true" />
              {roleMeta.label}
            </span>
            {user.created_at && (
              <p className="mt-4 text-xs text-muted-foreground">
                Member since {format(new Date(user.created_at), "MMMM d, yyyy")}
              </p>
            )}
            <p className="mt-3 rounded-md bg-muted px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Your role controls which tickets and tools you can access. Ask an
              administrator to change it.
            </p>
          </CardContent>
        </Card>

        {/* Edit form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <BadgeCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              Account details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <FormField label="Full name" htmlFor="profile-name" required error={errors.name?.message}>
                <Input
                  id="profile-name"
                  autoComplete="name"
                  invalid={!!errors.name}
                  {...register("name")}
                />
              </FormField>

              <FormField
                label="Email"
                htmlFor="profile-email"
                required
                error={errors.email?.message}
                hint="Used to sign in and receive notifications."
              >
                <Input
                  id="profile-email"
                  type="email"
                  autoComplete="email"
                  invalid={!!errors.email}
                  {...register("email")}
                />
              </FormField>

              <div className="flex justify-end border-t pt-4">
                <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
                  {!isSubmitting && <Save aria-hidden="true" />}
                  {isSubmitting ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
