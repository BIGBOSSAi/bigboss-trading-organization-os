// Happi's prompt-pack engine: build generation prompts, parse the model's JSON robustly,
// dedupe to a target count, and render a branded, sellable pack (HTML for PDF, Markdown
// for the vault). Pure/runtime-agnostic so it's testable and usable on both sides.

export interface PromptItem {
  id: number;
  prompt: string;
  short_use: string;
  example_instruction: string;
  expected_output_type: string;
}

export type RawPromptItem = Omit<PromptItem, "id">;

export function buildBatchPrompt(topic: string, count: number, focus?: string): string {
  return [
    "You are PromptMaster, an expert prompt engineer.",
    `Produce exactly ${count} unique, high-quality, actionable ChatGPT prompts for the niche: "${topic}".`,
    focus ? `Focus THIS batch specifically on: ${focus}. Keep these distinct from other angles of the niche.` : "",
    "Output ONLY a JSON array — no commentary, no markdown fences, no trailing text.",
    'Each element: {"prompt": string, "short_use": one short line, "example_instruction": one short line of expected user input, "expected_output_type": one of "text"|"list"|"table"|"script"|"plan"}.',
    "Every prompt must be specific and distinct in meaning from the others; vary tone and output length across the set.",
    "Keep prompts ready to paste and genuinely useful for someone working in this niche.",
  ].join("\n");
}

// Defensive: models sometimes wrap JSON in fences or add stray text.
export function parsePromptItems(text: string): RawPromptItem[] {
  const cleaned = text.replace(/```json/gi, "```").replace(/```/g, "");
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return (arr as Array<Record<string, unknown>>)
    .filter((x) => x && typeof x.prompt === "string" && String(x.prompt).trim())
    .map((x) => ({
      prompt: String(x.prompt).trim(),
      short_use: String(x.short_use ?? "").trim(),
      example_instruction: String(x.example_instruction ?? "").trim(),
      expected_output_type: (String(x.expected_output_type ?? "text").trim().toLowerCase() || "text"),
    }));
}

export function mergeUnique(batches: RawPromptItem[][], target: number): PromptItem[] {
  const seen = new Set<string>();
  const out: PromptItem[] = [];
  for (const batch of batches) {
    for (const item of batch) {
      const key = item.prompt.toLowerCase().replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ id: out.length + 1, ...item });
      if (out.length >= target) return out;
    }
  }
  return out;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderPackHtml(topic: string, items: PromptItem[]): string {
  const cards = items
    .map(
      (it) => `<article class="card">
  <div class="num">${it.id}</div>
  <p class="prompt">${escapeHtml(it.prompt)}</p>
  <p class="meta"><span>${escapeHtml(it.short_use)}</span><span class="tag">${escapeHtml(it.expected_output_type)}</span></p>
  ${it.example_instruction ? `<p class="eg">e.g. ${escapeHtml(it.example_instruction)}</p>` : ""}
</article>`,
    )
    .join("\n");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>BIGBoss Prompt Pack — ${escapeHtml(topic)}</title>
<style>
  @page { margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; color: #14161f; margin: 0; padding: 28px; background: #fff; }
  .cover { text-align: center; padding: 60px 20px 40px; border-bottom: 3px solid #00b3c4; margin-bottom: 28px; }
  .brand { letter-spacing: .35em; font-family: Arial, sans-serif; font-weight: 800; color: #00b3c4; font-size: 13px; }
  .cover h1 { font-size: 40px; margin: 14px 0 6px; }
  .cover .topic { font-size: 22px; color: #c026a8; font-style: italic; }
  .cover .count { margin-top: 16px; font-family: Arial, sans-serif; color: #555; }
  .card { border: 1px solid #e3e6ef; border-left: 4px solid #00b3c4; border-radius: 8px; padding: 14px 16px; margin: 0 0 12px; page-break-inside: avoid; }
  .num { font-family: Arial, sans-serif; font-weight: 800; color: #00b3c4; font-size: 13px; }
  .prompt { font-size: 15px; margin: 4px 0 8px; line-height: 1.5; }
  .meta { font-family: Arial, sans-serif; font-size: 12px; color: #666; display: flex; justify-content: space-between; gap: 10px; margin: 0; }
  .tag { background: #f0e6fb; color: #c026a8; border-radius: 999px; padding: 2px 10px; font-weight: 700; }
  .eg { font-family: Arial, sans-serif; font-size: 11px; color: #888; margin: 6px 0 0; }
  .footer { text-align: center; font-family: Arial, sans-serif; font-size: 11px; color: #999; margin-top: 24px; }
</style></head>
<body>
  <section class="cover">
    <div class="brand">BIGBOSS PROMPT PACK</div>
    <h1>200 Pro Prompts</h1>
    <div class="topic">${escapeHtml(topic)}</div>
    <div class="count">${items.length} ready-to-use ChatGPT prompts · Generated by Happi</div>
  </section>
  ${cards}
  <div class="footer">© BIGBoss · Prompt pack — ${escapeHtml(topic)}</div>
</body></html>`;
}

export function renderPackMarkdown(topic: string, items: PromptItem[]): string {
  const body = items
    .map((it) => `${it.id}. ${it.prompt}\n   - use: ${it.short_use} · type: ${it.expected_output_type}`)
    .join("\n");
  return `# BIGBoss Prompt Pack — ${topic}\n\n${items.length} prompts (by Happi).\n\n${body}\n`;
}
