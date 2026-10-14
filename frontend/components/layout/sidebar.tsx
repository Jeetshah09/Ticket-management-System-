"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy, TicketCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { getNavSections } from "@/components/layout/nav-config";
import { Separator } from "@/components/ui/separator";
import { ROLE_META } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

/**
 * Primary navigation. Rendered inline on desktop and inside a
 * slide-over dialog on mobile (see AppShell).
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const sections = getNavSections(user?.role ?? "customer");

  return (
    <nav className="flex h-full flex-col" aria-label="Main navigation">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <TicketCheck className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">DeskFlow</span>
        {user && (
          <Badge className="ml-auto ring-1 ring-inset" variant="outline">
            {ROLE_META[user.role].label}
          </Badge>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section, si) => (
          <div key={section.title ?? si} className="mb-5">
            {section.title && (
              <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {si < sections.length - 1 && <Separator className="mt-4 opacity-60" />}
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t px-5 py-3.5 text-[11px] leading-relaxed text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
          Support ticketing system
        </span>
      </div>
    </nav>
  );
}
