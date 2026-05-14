import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UpgradeModal } from "@/components/shared/upgrade-modal";

vi.mock("@/lib/hooks/use-billing", () => ({
  useCreateCheckout: () => ({
    isPending: false,
    mutateAsync: vi.fn(async () => ({ url: "" })),
  }),
}));

vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

describe("UpgradeModal", () => {
  it("shows plan information", () => {
    render(<UpgradeModal open onClose={() => undefined} />);
    expect(screen.getByText("Starter")).toBeTruthy();
    expect(screen.getByText("Pro")).toBeTruthy();
    expect(screen.getByText("500 minutes")).toBeTruthy();
  });
});
