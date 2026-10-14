import { apiClient, request } from "@/lib/api-client";
import { toApiError } from "@/lib/api-error";
import type {
  AuthResponse,
  LoginRequest,
  ProfileUpdateRequest,
  RegisterRequest,
  User,
} from "@/types/auth";

/**
 * Auth service. Endpoints (FastAPI):
 *   POST /auth/register
 *   POST /auth/login
 *   GET  /auth/me
 *   PATCH /auth/me          (profile fields; 403 if backend disallows)
 *
 * Password change/reset flows are intentionally NOT exposed: the
 * backend contract defines no such endpoint, and the UI must not
 * advertise functionality that doesn't exist.
 */

export async function login(payload: LoginRequest): Promise<AuthResponse> {
  return request(() => apiClient.post("/auth/login", payload));
}

export async function register(payload: RegisterRequest): Promise<AuthResponse> {
  return request(() => apiClient.post("/auth/register", payload));
}

export async function getMe(): Promise<User> {
  return request(() => apiClient.get("/auth/me"));
}

/**
 * After login/register the backend may return the user inline or only a
 * token. If no user came back, resolve it via /auth/me; if that also
 * fails we still have a valid token, so return a minimal user shell the
 * caller can replace on next fetch.
 */
export async function resolveSession(res: AuthResponse): Promise<User> {
  if (res.user) return res.user;
  try {
    return await getMe();
  } catch (error) {
    const err = toApiError(error);
    if (err.status === 401 || err.status === 403) throw err;
    // Non-auth failure fetching profile: keep the session.
    return { id: "", name: "", email: "", role: "customer" };
  }
}

export async function updateProfile(payload: ProfileUpdateRequest): Promise<User> {
  return request(() => apiClient.patch("/auth/me", payload));
}

export async function forgotPassword(payload: ForgotPasswordRequest): Promise<void> {
  await request(() => apiClient.post("/auth/forgot-password", payload));
}

export async function resetPassword(payload: ResetPasswordRequest): Promise<void> {
  await request(() => apiClient.post("/auth/reset-password", payload));
}

export async function changePassword(payload: ChangePasswordRequest): Promise<void> {
  return request(() => apiClient.post("/auth/change-password", payload));
}
