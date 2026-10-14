"use client";

import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { SidebarNav } from "@/components/layout/sidebar";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Responsive shell: fixed sidebar on lg+, slide-over drawer on smaller
 * screens. Header is sticky and holds the mobile trigger, notification
 * bell, and account menu.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-card lg:block">
        <SidebarNav />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-6">
          {/* Mobile navigation drawer */}
          <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation menu"
              >
                <Menu aria-hidden="true" />
              </Button>
            </DialogTrigger>
            <DialogContent className="fixed inset-y-0 left-0 right-auto m-0 h-full w-72 max-w-[85vw] translate-x-0 rounded-none border-y-0 border-l-0 p-0 data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left">
              <DialogTitle className="sr-only">Navigation</DialogTitle>
              <SidebarNav onNavigate={closeMobile} />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3.5"
                onClick={closeMobile}
                aria-label="Close navigation menu"
              >
                <X aria-hidden="true" />
              </Button>
            </DialogContent>
          </Dialog>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-muted-foreground">Support ticketing</p>
          </div>

          <NotificationBell />
          <UserMenu />
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
