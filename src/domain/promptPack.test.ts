import { describe, expect, it } from "vitest";
import { buildBatchPrompt, mergeUnique, parsePromptItems, renderPackMarkdown } from "./promptPack";

describe("promptPack", () => {
  it("builds a batch prompt naming the niche and count", () => {
    const p = buildBatchPrompt("Instagram fashion model", 50);
    expect(p).toContain("Instagram fashion model");
    expect(p).toContain("50");
    expect(p).toContain("JSON array");
  });

  it("parses a JSON array even when wrapped in code fences + commentary", () => {
    const text = 'Here you go:\n```json\n[{"prompt":"Write a caption","short_use":"captions","example_instruction":"give a topic","expected_output_type":"text"}]\n```';
    const items = parsePromptItems(text);
    expect(items).toHaveLength(1);
    expect(items[0].prompt).toBe("Write a caption");
    expect(items[0].expected_output_type).toBe("text");
  });

  it("returns empty on unparseable text", () => {
    expect(parsePromptItems("no json here")).toEqual([]);
  });

  it("dedupes by prompt meaning, re-ids, and caps at target", () => {
    const a = [{ prompt: "Do X", short_use: "", example_instruction: "", expected_output_type: "text" }];
    const b = [
      { prompt: "do x", short_use: "", example_instruction: "", expected_output_type: "text" }, // dup (case/space)
      { prompt: "Do Y", short_use: "", example_instruction: "", expected_output_type: "list" },
      { prompt: "Do Z", short_use: "", example_instruction: "", expected_output_type: "plan" },
    ];
    const merged = mergeUnique([a, b], 2);
    expect(merged.map((m) => m.prompt)).toEqual(["Do X", "Do Y"]);
    expect(merged.map((m) => m.id)).toEqual([1, 2]);
  });

  it("renders a branded markdown pack with the count", () => {
    const md = renderPackMarkdown("Study", mergeUnique([[{ prompt: "Summarize", short_use: "", example_instruction: "", expected_output_type: "list" }]], 1));
    expect(md).toContain("BIGBoss Prompt Pack — Study");
    expect(md).toContain("1 prompts");
  });
});
