import { describe, expect, it, vi } from "vitest";

import { usePlanLimits } from "@/lib/hooks/use-plan-limits";

vi.mock("@/lib/hooks/use-billing", () => ({
  useBillingUsage: () => ({
    data: {
      minutes_used: 120,
      minutes_limit: 500,
      plan: "starter",
      percent: 24,
      renewal_date: null,
      agents_count: 2,
      campaigns_count: 5,
      kb_docs_count: 10,
      limits: { agents: 3, campaigns: 5, kb_docs: 50, minutes: 500 },
    },
    isLoading: false,
    isError: false,
  }),
}));

describe("usePlanLimits", () => {
  it("evaluates quota gates correctly", () => {
    const limits = usePlanLimits();
    expect(limits.canCreateAgent()).toBe(true);
    expect(limits.canLaunchCampaign()).toBe(false);
    expect(limits.canUploadKBDoc()).toBe(true);
    expect(limits.minutesRemaining()).toBe(380);
  });
});
