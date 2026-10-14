import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-[90px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        invalid && "border-destructive focus-visible:ring-destructive",
        className
      )}
      ref={ref}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export { Textarea };
