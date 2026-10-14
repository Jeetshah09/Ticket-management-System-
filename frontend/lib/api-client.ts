import axios, {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from "axios";
import { getToken, clearToken } from "@/lib/token";
import { toApiError, ApiError } from "@/lib/api-error";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Central Axios instance.
 *
 * - Injects the Bearer token on every request.
 * - Normalizes every failure (network, timeout, 4xx, 5xx) into ApiError
 *   so callers get consistent messages/field errors.
 * - On 401 the session is cleared and the user is sent to /login with a
 *   `next` param so they land back where they were after signing in.
 *   (Login/register requests themselves are excluded — those 401s are
 *   credential errors, not expired sessions.)
 */

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token) {
    config.headers.set?.("Authorization", `Bearer ${token}`);
  }
  return config;
});

const AUTH_PATHS = ["/auth/login", "/auth/register", "/auth/refresh"];

function isAuthPath(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_PATHS.some((p) => url.includes(p));
}

let redirectingToLogin = false;

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url;

    if (
      status === 401 &&
      !isAuthPath(requestUrl) &&
      typeof window !== "undefined"
    ) {
      clearToken();
      // Avoid stacking multiple redirects for parallel 401s.
      if (!redirectingToLogin && !window.location.pathname.startsWith("/login")) {
        redirectingToLogin = true;
        const next = encodeURIComponent(
          window.location.pathname + window.location.search
        );
        window.location.assign(`/login?next=${next}`);
      }
    } else {
      redirectingToLogin = false;
    }

    return Promise.reject(toApiError(error));
  }
);

/** Typed helper: throws ApiError with a user-readable message. */
export async function request<T>(
  fn: () => Promise<{ data: T }>
): Promise<T> {
  try {
    const res = await fn();
    return res.data;
  } catch (error) {
    throw toApiError(error);
  }
}

export { ApiError };
export const authHeader = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** Re-export for services that need raw headers (e.g. uploads). */
export { AxiosHeaders };
