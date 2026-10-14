"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_META } from "@/lib/constants";
import type { Role } from "@/types/auth";

/**
 * Friendly 403-style view for signed-in users without the required role.
 * Shown by <RequireRole>. Backend authorization is still authoritative.
 */
export function AccessDenied({ requiredRoles }: { requiredRoles?: Role[] }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600 ring-1 ring-red-100">
        <ShieldAlert className="h-7 w-7" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-xl font-semibold tracking-tight">Access denied</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Your account does not have permission to view this page.
        {requiredRoles && requiredRoles.length > 0 && (
          <>
            {" "}
            This area requires the{" "}
            <span className="font-medium text-foreground">
              {requiredRoles.map((r) => ROLE_META[r].label).join(" or ")}
            </span>{" "}
            role.
          </>
        )}{" "}
        If you believe this is a mistake, contact your administrator.
      </p>
      <Button asChild className="mt-6" variant="outline">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
