"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { hasRole } from "@/lib/permissions";
import type { Role } from "@/types/auth";
import { FullPageLoader } from "@/components/shared/full-page-loader";
import { AccessDenied } from "@/components/shared/access-denied";

/**
 * Route guards.
 *
 * RequireAuth:  no session → /login?next=<path>; loading → spinner.
 * RequireRole:  additionally renders a friendly access-denied view for
 *               signed-in users whose role isn't allowed. The backend
 *               still enforces authorization — these guards only shape
 *               navigation.
 */

function useRedirectTarget(pathname: string): string {
  return encodeURIComponent(pathname);
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const next = useRedirectTarget(pathname);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=${next}`);
    }
  }, [status, router, next]);

  if (status === "loading") return <FullPageLoader label="Checking your session…" />;
  if (status === "unauthenticated") return <FullPageLoader label="Redirecting to sign in…" />;
  return <>{children}</>;
}

export function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: ReactNode;
}) {
  const { user, status } = useAuth();

  if (status === "loading" || !user) {
    return <FullPageLoader label="Checking your session…" />;
  }

  if (!hasRole(user, ...roles)) {
    return <AccessDenied requiredRoles={roles} />;
  }

  return <>{children}</>;
}
