/**
 * Authentication token storage.
 *
 * Strategy: the backend issues a JWT access token on login/register.
 * We persist ONLY the token (never passwords or profile data) in
 * localStorage under a single namespaced key, attach it to every API
 * request as `Authorization: Bearer <token>`, and clear it on 401 or
 * explicit logout.
 *
 * The token is read lazily so this module is safe to import on the
 * server (typeof window checks) — SSR renders treat the user as
 * signed out and the client hydrates the session.
 */

const TOKEN_KEY = "tms.access_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage unavailable (private mode) — session simply won't persist.
  }
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}
