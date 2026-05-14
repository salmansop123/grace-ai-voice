import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import CallsPage from "@/app/dashboard/calls/page";

vi.mock("next/link", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/lib/hooks/use-calls", () => ({
  useCalls: () => ({
    data: [
      {
        id: "c1",
        from_number: "+15550000000",
        agent_name: "Grace",
        direction: "INBOUND",
        duration: 90,
        outcome: "booked",
        status: "completed",
        connected: true,
        had_conversation: true,
      },
    ],
    isLoading: false,
    isError: false,
  }),
}));

describe("CallsPage", () => {
  it("renders call history heading", () => {
    render(<CallsPage />);
    expect(screen.getByText("Call History")).toBeTruthy();
    expect(screen.getByText("Customers Picked Up")).toBeTruthy();
  });
});
