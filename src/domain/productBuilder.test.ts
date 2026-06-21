import { describe, expect, it, vi } from "vitest";
import { buildProduct } from "./productBuilder";

const fixedNow = () => new Date("2026-06-21T00:00:00.000Z");

describe("buildProduct", () => {
  it("uses the AI-brain output when generation succeeds", async () => {
    const generate = vi.fn().mockResolvedValue({ status: "complete", text: "# Course\nGenerated body.", provider: "fcc" });
    const product = await buildProduct("course", "Liquidity", { generate, now: fixedNow });

    expect(product.typeId).toBe("course");
    expect(product.topic).toBe("Liquidity");
    expect(product.markdown).toContain("Generated body.");
    expect(product.provider).toBe("fcc");
  });

  it("falls back to the deterministic scaffold when generation fails", async () => {
    const generate = vi.fn().mockResolvedValue({ status: "failed", text: "", provider: "none" });
    const product = await buildProduct("funnel", "Smart Money", { generate, now: fixedNow });

    expect(product.provider).toBe("fallback");
    expect(product.markdown).toContain("# Sales Funnel: Smart Money");
    expect(product.markdown).toContain("## Offer");
  });

  it("falls back when generation throws", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("offline"));
    const product = await buildProduct("ebook", "Psychology", { generate, now: fixedNow });
    expect(product.provider).toBe("fallback");
    expect(product.markdown).toContain("# Ebook: Psychology");
  });

  it("throws on an unknown product type", async () => {
    const generate = vi.fn();
    await expect(buildProduct("bogus", "x", { generate, now: fixedNow })).rejects.toThrow(/Unknown product type/);
  });
});
