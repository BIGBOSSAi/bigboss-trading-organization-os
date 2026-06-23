import { describe, expect, it } from "vitest";
import { buildDailyContentPrompt, msUntilNextRun, pickDailyTopic } from "./contentScheduler";

describe("contentScheduler", () => {
  it("picks a stable topic per day and rotates across days", () => {
    const day1 = new Date("2026-06-22T09:00:00.000Z");
    const day1Again = new Date("2026-06-22T20:00:00.000Z");
    const day2 = new Date("2026-06-23T09:00:00.000Z");
    expect(pickDailyTopic(day1)).toBe(pickDailyTopic(day1Again));
    expect(pickDailyTopic(day1)).not.toBe(pickDailyTopic(day2));
  });

  it("builds a guardrailed prompt that names the topic", () => {
    const prompt = buildDailyContentPrompt("risk management fundamentals");
    expect(prompt).toContain("risk management fundamentals");
    expect(prompt).toContain("no financial advice");
  });

  it("schedules the next run within the next 24h and in the future", () => {
    const now = new Date("2026-06-22T10:30:00.000Z");
    const delay = msUntilNextRun(now, 9);
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });
});
