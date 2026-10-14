import type { Metadata } from "next";
import { RequireAuth } from "@/contexts/route-guards";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "DeskFlow",
};

/**
 * Authenticated area: every route under (app) requires a session and
 * renders inside the responsive shell (sidebar + header).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
