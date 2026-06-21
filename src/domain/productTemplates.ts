// Product templates: one-click scaffolds the Launch agent can turn into real product
// assets for the trading-education business. Pure/runtime-agnostic so it is testable
// and usable from both the deterministic fallback and the LLM-backed builder.

export interface ProductType {
  id: string;
  name: string;
  description: string;
  sections: string[];
  promptHint: string;
}

export const productTypes: ProductType[] = [
  {
    id: "course",
    name: "Online Course",
    description: "A structured multi-module course for AI Trading College.",
    sections: ["Overview", "Learning Outcomes", "Module Outline", "Lesson Breakdown", "Assessment", "Pricing & Positioning"],
    promptHint: "Design a progressive curriculum a beginner can follow to competence.",
  },
  {
    id: "lead-magnet",
    name: "Lead Magnet",
    description: "A free high-value asset that captures leads for the funnel.",
    sections: ["Hook", "Promise", "Core Value", "Content Outline", "Call To Action", "Capture Strategy"],
    promptHint: "Make it instantly useful and quick to consume so it earns the opt-in.",
  },
  {
    id: "funnel",
    name: "Sales Funnel",
    description: "An offer-to-sale funnel with pages and email follow-up.",
    sections: ["Offer", "Landing Page Sections", "Email Sequence", "Upsell", "Pricing", "Metrics To Track"],
    promptHint: "Map the full path from cold visitor to paying customer.",
  },
  {
    id: "ebook",
    name: "Ebook",
    description: "A short authority-building ebook.",
    sections: ["Title & Subtitle", "Chapter Outline", "Key Takeaways", "Call To Action"],
    promptHint: "Position the founder as a credible guide; keep chapters skimmable.",
  },
  {
    id: "signal-service",
    name: "Signal / Education Service",
    description: "A recurring subscription education service (not financial advice).",
    sections: ["Value Proposition", "Delivery Format", "Risk Disclaimer", "Tiers & Pricing", "Onboarding"],
    promptHint: "Frame as education and process, never as guaranteed-profit signals.",
  },
  {
    id: "masterclass",
    name: "Live Masterclass",
    description: "A single high-impact live session with an offer.",
    sections: ["Big Idea", "Agenda", "Key Lessons", "Offer Pitch", "Follow-up"],
    promptHint: "One transformational promise delivered in a single session.",
  },
  {
    id: "email-sequence",
    name: "Email Sequence",
    description: "A nurture/launch email sequence.",
    sections: ["Goal", "Sequence Map", "Per-Email Drafts", "Call To Action"],
    promptHint: "Each email earns the open of the next; one clear CTA per email.",
  },
];

export interface BuiltProduct {
  id: string;
  typeId: string;
  typeName: string;
  topic: string;
  createdAt: string;
  markdown: string;
  provider: string;
}

export function getProductType(id: string): ProductType | undefined {
  return productTypes.find((type) => type.id === id);
}

export function renderScaffoldMarkdown(type: ProductType, topic: string): string {
  const lines = [`# ${type.name}: ${topic}`, "", `> ${type.description}`, ""];
  for (const section of type.sections) {
    lines.push(`## ${section}`, "", "_(to be filled)_", "");
  }
  return lines.join("\n").trim();
}

export function buildProductPrompt(type: ProductType, topic: string): string {
  return [
    "You are Launch, the product engine for a trading-education business.",
    `Create a ${type.name} about: "${topic}".`,
    type.promptHint,
    "Include each of these as a Markdown H2 section, filled with concrete, usable content:",
    ...type.sections.map((section) => `- ${section}`),
    "",
    "Guardrails: no live-trading instructions, no profit guarantees; present any pricing as a suggestion that requires human approval.",
    "Return only clean Markdown starting with an H1 title.",
  ].join("\n");
}
