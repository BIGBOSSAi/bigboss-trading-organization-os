import { describe, expect, it } from "vitest";
import { renderMissionMarkdown, type Mission } from "./mission";

function sampleMission(): Mission {
  return {
    id: "mission-1",
    goal: "Turn the liquidity lesson into a funnel",
    createdAt: "2026-06-20T00:00:00.000Z",
    approvalRequired: true,
    subtasks: [],
    results: [
      { subtaskId: "sub-dean", agentId: "dean", status: "complete", output: "Lesson body.", provider: "fcc" },
      { subtaskId: "sub-launch", agentId: "launch", status: "complete", output: "Funnel body.", provider: "fcc" },
    ],
    messages: [
      { from: "dean", to: "all", summary: "Dean: lesson ready", at: "2026-06-20T00:00:00.000Z" },
      { from: "router", to: "all", summary: "Synthesized.", at: "2026-06-20T00:00:00.000Z" },
    ],
    summary: "2 agents completed.",
    finalResult: "FINAL combined funnel.",
  };
}

describe("renderMissionMarkdown", () => {
  it("renders a full transcript with final result, per-agent outputs, and the log", () => {
    const markdown = renderMissionMarkdown(sampleMission());

    expect(markdown).toContain("# Mission: Turn the liquidity lesson into a funnel");
    expect(markdown).toContain("Approval required: yes");
    expect(markdown).toContain("## Final Result");
    expect(markdown).toContain("FINAL combined funnel.");
    expect(markdown).toContain("### Dean (fcc)");
    expect(markdown).toContain("Lesson body.");
    expect(markdown).toContain("### Launch (fcc)");
    expect(markdown).toContain("## Inter-Agent Log");
    expect(markdown).toContain("**dean → all** Dean: lesson ready");
  });
});
