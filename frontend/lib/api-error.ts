import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

/**
 * API error normalization.
 *
 * The FastAPI backend may return errors as:
 *   - { "detail": "message" }                       (HTTPException)
 *   - [{ "loc": [...], "msg": "...", "type": "..." }]  (request validation)
 *   - { "detail": { "field": "msg", ... } }          (custom shape)
 *   - plain text / no body (proxy failures)
 * Network failures and timeouts have no response at all.
 */

export class ApiError extends Error {
  readonly status: number | null;
  /** Field-level messages keyed by field name, for form display. */
  readonly fieldErrors: Record<string, string>;
  /** True when the request never reached the server. */
  readonly isNetworkError: boolean;

  constructor(
    message: string,
    status: number | null = null,
    fieldErrors: Record<string, string> = {},
    isNetworkError = false
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.isNetworkError = isNetworkError;
  }
}

interface FastApiValidationItem {
  loc?: (string | number)[];
  msg?: string;
  type?: string;
  field?: string;
}

function extractDetail(data: unknown): {
  message: string | null;
  fieldErrors: Record<string, string>;
} {
  if (data == null) return { message: null, fieldErrors: {} };

  if (typeof data === "string") return { message: data, fieldErrors: {} };

  if (Array.isArray(data)) {
    const fieldErrors: Record<string, string> = {};
    for (const raw of data as FastApiValidationItem[]) {
      if (!raw || typeof raw !== "object") continue;
      // FastAPI puts the field name after "body" or "query" in loc.
      const path = Array.isArray(raw.loc) ? raw.loc : [];
      const field =
        raw.field ?? (path.length > 1 ? String(path[path.length - 1]) : "");
      const msg = raw.msg ?? "Invalid value";
      if (field) fieldErrors[field] = msg;
    }
    const message =
      Object.values(fieldErrors)[0] ??
      "The submitted data failed validation.";
    return { message, fieldErrors };
  }

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.detail === "string") {
      return { message: obj.detail, fieldErrors: {} };
    }
    if (typeof obj.message === "string") {
      return { message: obj.message, fieldErrors: {} };
    }
    if (obj.detail && typeof obj.detail === "object") {
      const detail = obj.detail as Record<string, unknown>;
      const fieldErrors: Record<string, string> = {};
      for (const [k, v] of Object.entries(detail)) {
        fieldErrors[k] = typeof v === "string" ? v : String(v);
      }
      const message =
        Object.values(fieldErrors)[0] ?? "The request could not be processed.";
      return { message, fieldErrors };
    }
    if (Array.isArray(obj.detail)) {
      return extractDetail(obj.detail);
    }
  }

  return { message: null, fieldErrors: {} };
}

/** Human-readable message for an axios rejection value. */
export function toApiError(error: unknown): ApiError {
  // Already normalized.
  if (error instanceof ApiError) return error;

  // Axios-shaped error without a response → network/timeout failure.
  if (typeof error === "object" && error !== null && "isAxiosError" in error) {
    const err = error as {
      response?: { status?: number; data?: unknown };
      code?: string;
      message?: string;
    };
    if (!err.response) {
      const timedOut = err.code === "ECONNABORTED";
      return new ApiError(
        timedOut
          ? "The request timed out. Please check your connection and try again."
          : "Cannot reach the server. Please make sure the backend is running and try again.",
        null,
        {},
        true
      );
    }
    const status = err.response.status ?? null;
    const { message, fieldErrors } = extractDetail(err.response.data);
    const fallback =
      status === 401
        ? "Your session is not valid. Please sign in again."
        : status === 403
          ? "You do not have permission to perform this action."
          : status === 404
            ? "The requested resource was not found."
            : status && status >= 500
              ? "The server encountered an error. Please try again shortly."
              : "The request failed.";
    return new ApiError(message ?? fallback, status, fieldErrors, false);
  }

  if (error instanceof Error) return new ApiError(error.message, null, {}, true);
  return new ApiError("An unexpected error occurred.", null, {}, true);
}

/** User-facing message from any thrown value. */
export function errorMessage(error: unknown): string {
  return toApiError(error).message;
}

/* ------------------------------- form helpers ------------------------------- */

/**
 * Map backend field errors onto a react-hook-form setError function.
 * Returns the field names that were set so callers can decide whether
 * a generic toast is still needed.
 *
 * Usage: applyFieldErrors<LoginFormValues>(error, setError)
 */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>
): string[] {
  const apiError = toApiError(error);
  const names = Object.keys(apiError.fieldErrors);
  for (const [field, message] of Object.entries(apiError.fieldErrors)) {
    setError(field as Path<T>, { type: "server", message });
  }
  return names;
}
