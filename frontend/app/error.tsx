"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Global error boundary. Catches render-time crashes anywhere in the
 * app tree and offers a recovery action instead of a blank screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface in dev; production reporting can hook in here later.
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="h-7 w-7" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        An unexpected error occurred while rendering this page. You can try
        again — if the problem persists, check that the backend is running.
      </p>
      <Button className="mt-6" onClick={reset}>
        <RefreshCw aria-hidden="true" /> Try again
      </Button>
    </div>
  );
}
