import { describe, expect, it } from "vitest";
import { toApiError, errorMessage, ApiError } from "@/lib/api-error";

function axiosLike(
  status: number | null,
  data: unknown,
  opts: { noResponse?: boolean; code?: string } = {}
) {
  return {
    isAxiosError: true,
    message: "boom",
    code: opts.code,
    response: opts.noResponse ? undefined : { status, data },
  };
}

describe("toApiError", () => {
  it("extracts FastAPI string detail", () => {
    const err = toApiError(axiosLike(404, { detail: "Ticket not found" }));
    expect(err.status).toBe(404);
    expect(err.message).toBe("Ticket not found");
    expect(err.isNetworkError).toBe(false);
  });

  it("maps FastAPI validation arrays to field errors", () => {
    const err = toApiError(
      axiosLike(422, [
        { loc: ["body", "email"], msg: "Value is not a valid email address" },
        { loc: ["body", "password"], msg: "Field required" },
      ])
    );
    expect(err.status).toBe(422);
    expect(err.fieldErrors.email).toBe("Value is not a valid email address");
    expect(err.fieldErrors.password).toBe("Field required");
    expect(err.message).toBeTruthy();
  });

  it("maps object-shaped detail to field errors", () => {
    const err = toApiError(
      axiosLike(400, { detail: { email: "Already registered" } })
    );
    expect(err.fieldErrors.email).toBe("Already registered");
    expect(err.message).toBe("Already registered");
  });

  it("produces a network error when there is no response", () => {
    const err = toApiError(axiosLike(null, null, { noResponse: true }));
    expect(err.isNetworkError).toBe(true);
    expect(err.status).toBeNull();
    expect(err.message).toMatch(/backend is running/i);
  });

  it("reports timeouts distinctly", () => {
    const err = toApiError(
      axiosLike(null, null, { noResponse: true, code: "ECONNABORTED" })
    );
    expect(err.message).toMatch(/timed out/i);
  });

  it("falls back to a friendly 500 message", () => {
    const err = toApiError(axiosLike(500, null));
    expect(err.message).toMatch(/server encountered an error/i);
  });

  it("passes through existing ApiError instances", () => {
    const original = new ApiError("keep me", 403);
    expect(toApiError(original)).toBe(original);
    expect(errorMessage(original)).toBe("keep me");
  });
});
