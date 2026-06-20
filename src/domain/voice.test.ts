import { describe, expect, it } from "vitest";
import { interpretVoiceCommand, stripMarkdownForSpeech } from "./voice";

describe("interpretVoiceCommand", () => {
  it("detects a mission command and strips the trigger", () => {
    const result = interpretVoiceCommand("Run mission turn this lesson into a funnel");
    expect(result.action).toBe("mission");
    expect(result.text).toBe("turn this lesson into a funnel");
  });

  it("detects a route command", () => {
    const result = interpretVoiceCommand("Route command build a liquidity lesson");
    expect(result.action).toBe("route");
    expect(result.text).toBe("build a liquidity lesson");
  });

  it("strips filler words after the trigger", () => {
    const result = interpretVoiceCommand("mission to publish a LinkedIn post");
    expect(result.action).toBe("mission");
    expect(result.text).toBe("publish a LinkedIn post");
  });

  it("falls back to filling the command box when there is no trigger", () => {
    const result = interpretVoiceCommand("backtest this MT5 bot");
    expect(result.action).toBe("fill");
    expect(result.text).toBe("backtest this MT5 bot");
  });
});

describe("stripMarkdownForSpeech", () => {
  it("removes markdown syntax so TTS reads clean text", () => {
    const markdown = "# Lesson\n\n- **Liquidity** is `key`.\n\nSee [docs](http://x).";
    const spoken = stripMarkdownForSpeech(markdown);
    expect(spoken).toBe("Lesson Liquidity is key. See docs.");
  });

  it("drops fenced code blocks", () => {
    expect(stripMarkdownForSpeech("Intro\n```\ncode here\n```\nOutro")).toBe("Intro Outro");
  });
});
