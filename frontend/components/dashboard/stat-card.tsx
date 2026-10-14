import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tone?: "default" | "primary" | "warning" | "success";
}

const toneStyles = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  warning: "bg-amber-50 text-amber-700",
  success: "bg-emerald-50 text-emerald-700",
};

/** Compact metric card used across dashboards. */
export function StatCard({ label, value, icon: Icon, hint, tone = "default" }: StatCardProps) {
  return (
    <div className="h-full rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            toneStyles[tone]
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
