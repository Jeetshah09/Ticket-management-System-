"use client";

import { Loader2 } from "lucide-react";

export function FullPageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
