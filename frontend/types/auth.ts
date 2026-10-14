/**
 * Shared domain types for the Ticket Management System frontend.
 *
 * These mirror the FastAPI/Pydantic schemas described in the backend
 * master prompt. When the real backend is available, verify against
 * its OpenAPI schema at /docs and adjust in this single place.
 */

export type Role = "customer" | "agent" | "admin";

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface User extends UserSummary {
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type?: string;
  user?: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  /** Defaults to "customer" on the backend. */
  role?: Role;
  /** Required only when role is "admin" (matches ADMIN_INVITE_CODE). */
  invite_code?: string;
}

export interface ProfileUpdateRequest {
  name?: string;
  email?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}
