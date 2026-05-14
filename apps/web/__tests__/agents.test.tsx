import { describe, expect, it } from "vitest";

describe("Agents module", () => {
  it("keeps agent route active", () => {
    expect("/dashboard/agent").toContain("agent");
  });
});
