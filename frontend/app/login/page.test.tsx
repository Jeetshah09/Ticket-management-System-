import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn() }),
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams(""),
}));

const loginMock = vi.fn();

vi.mock("@/services", () => ({
  auth: {
    login: (...args: unknown[]) => loginMock(...args),
    resolveSession: vi.fn(async (res: { user?: unknown }) => res.user),
    getMe: vi.fn(),
  },
}));

import LoginPage from "@/app/login/page";
import { AuthProvider } from "@/contexts/auth-context";

function renderLogin() {
  return render(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    localStorage.clear();
    replace.mockClear();
    loginMock.mockReset();
  });

  it("shows field errors when submitting an empty form", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid email address", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText("Enter a valid email address.")
    ).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("submits once, disables the button while pending, then navigates", async () => {
    const user = userEvent.setup();
    let resolveLogin!: (value: unknown) => void;
    loginMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        })
    );

    renderLogin();

    await user.type(screen.getByLabelText(/email/i), "agent@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret123");

    const button = screen.getByRole("button", { name: /sign in/i });
    await user.click(button);

    // Pending: button disabled with pending label, only one request out.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
    });
    expect(loginMock).toHaveBeenCalledTimes(1);

    resolveLogin({
      access_token: "jwt-token",
      user: { id: "1", name: "Agent A", email: "agent@example.com", role: "agent" },
    });

    // Role-based landing: an agent goes straight to the ticket queue.
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/tickets");
    });
    // Token persisted (session strategy) and never the password.
    expect(localStorage.getItem("tms.access_token")).toBe("jwt-token");
    expect(localStorage.getItem("password")).toBeNull();
  });
});
