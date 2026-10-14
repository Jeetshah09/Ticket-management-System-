"use client";

import { useId, type ReactNode } from "react";
import { Label } from "@/components/ui/label";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Accessible field wrapper: label + control + error message wired with
 * aria-describedby / aria-invalid. Controls receive the generated id
 * via their `id` prop from the form.
 */
export function FormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className,
}: FormFieldProps) {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5 block">
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {children}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
