// Pure helpers for the daily content-draft scheduler: deterministic topic rotation,
// prompt construction, and next-run timing. The server scheduler uses these.

const topics = [
  "market liquidity for beginner traders",
  "smart money vs retail behavior",
  "trading psychology and discipline",
  "risk management fundamentals",
  "market structure and order flow",
  "how central banks move markets",
  "the life cycle of a trade",
];

export function pickDailyTopic(date: Date): string {
  const dayIndex = Math.floor(date.getTime() / 86_400_000);
  return topics[((dayIndex % topics.length) + topics.length) % topics.length];
}

export function buildDailyContentPrompt(topic: string): string {
  return [
    "You are Voice, the brand content agent for a trading-education business.",
    `Write a short, engaging social post (120-180 words) about: ${topic}.`,
    "Hook in the first line, 2-3 punchy insights, then one clear call to action to learn more.",
    "Guardrails: education only — no profit guarantees, no financial advice, no live-trading signals.",
    "Return just the post text (no markdown headings).",
  ].join("\n");
}

// Milliseconds until the next occurrence of hourLocal:00 (today if still ahead, else tomorrow).
export function msUntilNextRun(now: Date, hourLocal: number): number {
  const next = new Date(now);
  next.setHours(hourLocal, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}
