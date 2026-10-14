import { describe, expect, it } from "vitest";
import {
  hasRole,
  isAdmin,
  isAgent,
  isCustomer,
  canManageTicket,
  canAddInternalNote,
  landingPathFor,
} from "@/lib/permissions";
import type { Role } from "@/types/auth";

const user = (role: Role) => ({ id: "1", name: "Test", email: "t@t.co", role });

describe("role permissions", () => {
  it("identifies each role", () => {
    expect(isCustomer(user("customer"))).toBe(true);
    expect(isAgent(user("agent"))).toBe(true);
    expect(isAdmin(user("admin"))).toBe(true);
    expect(isCustomer(user("agent"))).toBe(false);
    expect(isAdmin(user("customer"))).toBe(false);
  });

  it("supports multi-role checks", () => {
    expect(hasRole(user("admin"), "agent", "admin")).toBe(true);
    expect(hasRole(user("customer"), "agent", "admin")).toBe(false);
    expect(hasRole(null, "customer")).toBe(false);
  });

  it("restricts ticket management to agent/admin", () => {
    expect(canManageTicket(user("customer"))).toBe(false);
    expect(canManageTicket(user("agent"))).toBe(true);
    expect(canManageTicket(user("admin"))).toBe(true);
    expect(canManageTicket(null)).toBe(false);
  });

  it("restricts internal notes to agent/admin", () => {
    expect(canAddInternalNote(user("customer"))).toBe(false);
    expect(canAddInternalNote(user("agent"))).toBe(true);
    expect(canAddInternalNote(user("admin"))).toBe(true);
  });

  it("sends each role to its own landing screen", () => {
    expect(landingPathFor("agent")).toBe("/tickets"); // agent → queue
    expect(landingPathFor("customer")).toBe("/dashboard");
    expect(landingPathFor("admin")).toBe("/dashboard");
  });
});
