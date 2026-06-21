import { describe, expect, it } from "vitest";
import { buildProductPrompt, getProductType, productTypes, renderScaffoldMarkdown } from "./productTemplates";

describe("productTemplates", () => {
  it("exposes a non-empty registry where every type has sections", () => {
    expect(productTypes.length).toBeGreaterThan(0);
    for (const type of productTypes) {
      expect(type.id).toBeTruthy();
      expect(type.sections.length).toBeGreaterThan(0);
    }
  });

  it("looks up a product type by id", () => {
    expect(getProductType("course")?.name).toBe("Online Course");
    expect(getProductType("nope")).toBeUndefined();
  });

  it("renders a deterministic scaffold with every section heading", () => {
    const type = getProductType("funnel")!;
    const markdown = renderScaffoldMarkdown(type, "Liquidity Mastery");
    expect(markdown).toContain("# Sales Funnel: Liquidity Mastery");
    for (const section of type.sections) {
      expect(markdown).toContain(`## ${section}`);
    }
  });

  it("builds a prompt that lists the topic and sections", () => {
    const type = getProductType("course")!;
    const prompt = buildProductPrompt(type, "Market Structure");
    expect(prompt).toContain("Market Structure");
    expect(prompt).toContain("Module Outline");
    expect(prompt).toContain("no profit guarantees");
  });
});
