import { RequireRole } from "@/contexts/route-guards";

/**
 * Admin area guard: renders an access-denied view for non-admins and
 * still defers every data operation to backend authorization.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RequireRole roles={["admin"]}>{children}</RequireRole>;
}
