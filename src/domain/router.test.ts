import { describe, expect, it } from "vitest";
import { routeCommand } from "./router";

describe("routeCommand", () => {
  it("routes curriculum requests to Dean", () => {
    const result = routeCommand("Build a liquidity lesson for AI Trading College");
    expect(result.agent.id).toBe("dean");
    expect(result.intent).toBe("education");
    expect(result.approvalRequired).toBe(false);
  });

  it("routes MT5 bot research to Forge with a trading safety gate", () => {
    const result = routeCommand("Backtest this MT5 bot and tell me if it is live ready");
    expect(result.agent.id).toBe("forge");
    expect(result.intent).toBe("bot_research");
    expect(result.approvalRequired).toBe(true);
    expect(result.riskLevel).toBe("high");
  });

  it("routes publishing requests to Voice with an approval gate", () => {
    const result = routeCommand("Write and publish a LinkedIn post about central banks");
    expect(result.agent.id).toBe("voice");
    expect(result.intent).toBe("content");
    expect(result.approvalRequired).toBe(true);
  });
});
