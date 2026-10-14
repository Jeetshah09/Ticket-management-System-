"use client";

import { AlertTriangle, PlugZap, RefreshCw, ServerOff, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toApiError } from "@/lib/api-error";

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  /** Overrides the derived title when needed. */
  title?: string;
}

/**
 * Error state that adapts messaging to the failure kind:
 * offline/unreachable backend vs server error vs other.
 */
export function ErrorState({ error, onRetry, title }: ErrorStateProps) {
  const err = toApiError(error);

  const Icon = err.isNetworkError ? ServerOff : err.status === 403 ? PlugZap : AlertTriangle;
  const derivedTitle =
    title ??
    (err.isNetworkError
      ? "Backend unreachable"
      : err.status === 403
        ? "Access denied"
        : err.status === 404
          ? "Not found"
          : "Something went wrong");

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/50 px-6 py-12 text-center"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
        {err.isNetworkError ? (
          <WifiOff className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Icon className="h-5 w-5" aria-hidden="true" />
        )}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-red-900">{derivedTitle}</h3>
      <p className="mt-1.5 max-w-md text-sm text-red-800/80">{err.message}</p>
      {onRetry && (
        <Button variant="outline" className="mt-5 bg-card" onClick={onRetry}>
          <RefreshCw aria-hidden="true" /> Try again
        </Button>
      )}
    </div>
  );
}
