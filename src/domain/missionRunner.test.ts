import { describe, expect, it, vi } from "vitest";
import { runMission, type MissionGenerateResult } from "./missionRunner";
import type { MissionPlan } from "./mission";

const fixedNow = () => new Date("2026-06-20T00:00:00.000Z");

function twoWavePlan(): MissionPlan {
  return {
    goal: "Turn the liquidity lesson into a funnel",
    approvalRequired: false,
    subtasks: [
      { id: "sub-dean", agentId: "dean", intent: "education", objective: "Make the lesson.", riskLevel: "low", approvalRequired: false, dependsOn: [] },
      { id: "sub-scout", agentId: "scout", intent: "research", objective: "Find the angle.", riskLevel: "low", approvalRequired: false, dependsOn: [] },
      { id: "sub-launch", agentId: "launch", intent: "product", objective: "Build the funnel.", riskLevel: "medium", approvalRequired: false, dependsOn: ["dean", "scout"] },
    ],
  };
}

describe("runMission", () => {
  it("runs producers before dependent packagers and passes their output downstream", async () => {
    const seenPrompts: string[] = [];
    const generate = vi.fn(async ({ prompt }: { prompt: string }): Promise<MissionGenerateResult> => {
      seenPrompts.push(prompt);
      if (prompt.startsWith("Make the lesson.")) return { status: "complete", text: "LESSON_OUTPUT", provider: "fcc" };
      if (prompt.startsWith("Find the angle.")) return { status: "complete", text: "ANGLE_OUTPUT", provider: "fcc" };
      return { status: "complete", text: "FUNNEL_OUTPUT", provider: "fcc" };
    });

    const mission = await runMission(twoWavePlan(), { generate, now: fixedNow });

    expect(mission.results).toHaveLength(3);
    expect(mission.results.every((result) => result.status === "complete")).toBe(true);

    // The launch prompt must have received the producers' outputs (inter-agent comms).
    const launchPrompt = seenPrompts.find((prompt) => prompt.startsWith("Build the funnel."));
    expect(launchPrompt).toContain("LESSON_OUTPUT");
    expect(launchPrompt).toContain("ANGLE_OUTPUT");

    // One message per subtask plus the router synthesis message.
    expect(mission.messages).toHaveLength(4);
    expect(mission.messages.at(-1)?.from).toBe("router");
    expect(mission.summary).toContain("3 agent(s)");
    expect(mission.finalResult).toBeTruthy();
  });

  it("synthesizes a final deliverable from all agent outputs", async () => {
    const generate = vi.fn(async ({ prompt }: { prompt: string }): Promise<MissionGenerateResult> => {
      if (prompt.startsWith("You are the BIGBoss Brain Router")) {
        // Synthesis must see every agent's output.
        expect(prompt).toContain("LESSON_OUTPUT");
        expect(prompt).toContain("ANGLE_OUTPUT");
        return { status: "complete", text: "FINAL_COMBINED_DELIVERABLE", provider: "fcc" };
      }
      if (prompt.startsWith("Make the lesson.")) return { status: "complete", text: "LESSON_OUTPUT", provider: "fcc" };
      if (prompt.startsWith("Find the angle.")) return { status: "complete", text: "ANGLE_OUTPUT", provider: "fcc" };
      return { status: "complete", text: "FUNNEL_OUTPUT", provider: "fcc" };
    });

    const mission = await runMission(twoWavePlan(), { generate, now: fixedNow });
    expect(mission.finalResult).toBe("FINAL_COMBINED_DELIVERABLE");
  });

  it("skips synthesis when disabled", async () => {
    const generate = vi.fn(async (): Promise<MissionGenerateResult> => ({ status: "complete", text: "X", provider: "fcc" }));
    const mission = await runMission(twoWavePlan(), { generate, now: fixedNow, synthesize: false });
    expect(mission.finalResult).toBe(mission.summary);
  });

  it("uses the deterministic fallback when generation fails", async () => {
    const generate = vi.fn(async (): Promise<MissionGenerateResult> => ({ status: "failed", text: "", provider: "none" }));

    const mission = await runMission(twoWavePlan(), { generate, now: fixedNow });

    expect(mission.results.every((result) => result.provider === "fallback")).toBe(true);
    expect(mission.results.every((result) => result.status === "complete")).toBe(true);
  });

  it("recovers when generation throws", async () => {
    const generate = vi.fn(async () => {
      throw new Error("network down");
    });

    const mission = await runMission(twoWavePlan(), { generate, now: fixedNow });

    expect(mission.results).toHaveLength(3);
    expect(mission.results.every((result) => result.provider === "fallback")).toBe(true);
  });
});
