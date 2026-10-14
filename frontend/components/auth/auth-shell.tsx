import Link from "next/link";
import { TicketCheck } from "lucide-react";

/** Shared chrome for the login/register screens. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="flex h-16 items-center border-b bg-background px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <TicketCheck className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">DeskFlow</span>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
          <p className="mt-5 text-center text-sm text-muted-foreground">{footer}</p>
        </div>
      </main>
    </div>
  );
}
