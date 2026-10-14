import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge, PriorityBadge } from "@/components/tickets/ticket-badges";
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/types/ticket";

/**
 * Badges must carry text labels (not color alone) for every enum value,
 * so status/priority are perceivable without color vision.
 */
describe("StatusBadge", () => {
  it("renders a readable label for every status", () => {
    for (const status of TICKET_STATUSES) {
      const { unmount } = render(<StatusBadge status={status} />);
      const label = {
        open: "Open",
        in_progress: "In Progress",
        pending: "Pending",
        resolved: "Resolved",
        closed: "Closed",
      }[status];
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });
});

describe("PriorityBadge", () => {
  it("renders a readable label for every priority", () => {
    for (const priority of TICKET_PRIORITIES) {
      const { unmount } = render(<PriorityBadge priority={priority} />);
      const label = {
        low: "Low",
        medium: "Medium",
        high: "High",
        urgent: "Urgent",
      }[priority];
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it("marks decorative icons as hidden from assistive tech", () => {
    render(<PriorityBadge priority="urgent" />);
    const badge = screen.getByText("Urgent").closest("span");
    expect(badge).toBeTruthy();
    expect(badge!.querySelector("svg")).toBeTruthy();
  });
});
