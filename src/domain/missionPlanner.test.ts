import { describe, expect, it } from "vitest";
import { planMission } from "./missionPlanner";

describe("planMission", () => {
  it("decomposes a multi-discipline goal and makes packagers depend on producers", () => {
    const plan = planMission("Turn this liquidity lesson into a $39 product funnel and publish a LinkedIn post");
    const agentIds = plan.subtasks.map((subtask) => subtask.agentId).sort();

    expect(agentIds).toContain("dean");
    expect(agentIds).toContain("launch");
    expect(agentIds).toContain("voice");

    const launch = plan.subtasks.find((subtask) => subtask.agentId === "launch");
    const voice = plan.subtasks.find((subtask) => subtask.agentId === "voice");
    expect(launch?.dependsOn).toContain("dean");
    expect(voice?.dependsOn).toContain("dean");
  });

  it("flags approval for high-risk goals (publish/pricing)", () => {
    const plan = planMission("Publish a LinkedIn post and set the price to $99");
    expect(plan.approvalRequired).toBe(true);
  });

  it("routes a bot research goal to Forge as high risk", () => {
    const plan = planMission("Backtest this MT5 bot and tell me if it is live ready");
    const forge = plan.subtasks.find((subtask) => subtask.agentId === "forge");
    expect(forge).toBeDefined();
    expect(forge?.riskLevel).toBe("high");
    expect(plan.approvalRequired).toBe(true);
  });

  it("falls back to a single Scout operations subtask when nothing matches", () => {
    const plan = planMission("zzzz qqqq");
    expect(plan.subtasks).toHaveLength(1);
    expect(plan.subtasks[0].agentId).toBe("scout");
    expect(plan.subtasks[0].intent).toBe("operations");
    expect(plan.approvalRequired).toBe(false);
  });
});
