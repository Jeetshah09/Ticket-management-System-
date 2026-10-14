import {
  AlertCircle,
  Circle,
  Clock,
  Flag,
  Minus,
  CheckCircle2,
  Archive,
  ArrowUp,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_META, PRIORITY_META } from "@/lib/constants";
import type { TicketPriority, TicketStatus } from "@/types/ticket";

const STATUS_ICONS: Record<TicketStatus, React.ComponentType<{ className?: string }>> = {
  open: Circle,
  in_progress: Loader2,
  pending: Clock,
  resolved: CheckCircle2,
  closed: Archive,
};

/**
 * Status badge — icon + text label + color, so status is never conveyed
 * by color alone.
 */
export function StatusBadge({ status }: { status: TicketStatus }) {
  const meta = STATUS_META[status];
  const Icon = STATUS_ICONS[status] ?? Circle;
  if (!meta) return <Badge variant="outline">{status}</Badge>;
  return (
    <Badge className={cn("ring-1 ring-inset", meta.badgeClass)}>
      <Icon className={cn("h-3 w-3", status === "in_progress" && "animate-spin")} aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}

const PRIORITY_ICONS: Record<TicketPriority, React.ComponentType<{ className?: string }>> = {
  low: Minus,
  medium: Flag,
  high: ArrowUp,
  urgent: AlertCircle,
};

/** Priority badge — icon (severity ramp) + text label. */
export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const meta = PRIORITY_META[priority];
  const Icon = PRIORITY_ICONS[priority] ?? Flag;
  if (!meta) return <Badge variant="outline">{priority}</Badge>;
  return (
    <Badge className={cn("ring-1 ring-inset", meta.badgeClass)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}
