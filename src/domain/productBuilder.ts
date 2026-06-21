// Builds a product asset from a template: one LLM call (via the AI brain) fills the
// template sections, with a deterministic scaffold fallback when generation fails.

import {
  buildProductPrompt,
  getProductType,
  renderScaffoldMarkdown,
  type BuiltProduct,
} from "./productTemplates";

export interface BuildProductOptions {
  generate: (request: { prompt: string }) => Promise<{ status: "complete" | "failed"; text: string; provider?: string }>;
  now?: () => Date;
}

export async function buildProduct(typeId: string, topic: string, options: BuildProductOptions): Promise<BuiltProduct> {
  const type = getProductType(typeId);
  if (!type) {
    throw new Error(`Unknown product type: ${typeId}`);
  }

  const now = options.now ?? (() => new Date());
  const createdAt = now().toISOString();
  const cleanTopic = topic.trim() || type.name;

  let markdown = renderScaffoldMarkdown(type, cleanTopic);
  let provider = "fallback";

  try {
    const generated = await options.generate({ prompt: buildProductPrompt(type, cleanTopic) });
    if (generated.status === "complete" && generated.text.trim()) {
      markdown = generated.text.trim();
      provider = generated.provider ?? "llm";
    }
  } catch {
    // keep deterministic scaffold
  }

  return {
    id: `product-${type.id}-${createdAt}`,
    typeId: type.id,
    typeName: type.name,
    topic: cleanTopic,
    createdAt,
    markdown,
    provider,
  };
}
