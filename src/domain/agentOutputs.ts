import type { AgentId } from "./agents";
import type { HermesTaskRecord } from "./hermesBridge";

export interface AgentOutputSection {
  heading: string;
  bullets: string[];
}

export interface AgentOutputDraft {
  id: string;
  taskId: string;
  agentId: AgentId;
  title: string;
  summary: string;
  sections: AgentOutputSection[];
  guardrails: string[];
  createdAt: string;
}

type OutputTemplate = Omit<AgentOutputDraft, "id" | "taskId" | "agentId" | "createdAt">;

export function generateAgentOutput(task: HermesTaskRecord): AgentOutputDraft {
  const template = templates[task.agentId](task);

  return {
    ...template,
    id: `output-${task.id}`,
    taskId: task.id,
    agentId: task.agentId,
    createdAt: new Date().toISOString(),
  };
}

const templates: Record<AgentId, (task: HermesTaskRecord) => OutputTemplate> = {
  dean: (task) => ({
    title: "AI Trading College Lesson Draft",
    summary: `Dean turns "${task.command}" into a teachable lesson for the AI Trading College.`,
    sections: [
      {
        heading: "Lesson Objective",
        bullets: [
          "Explain the concept in plain language before advanced terminology.",
          "Connect the idea to market structure, liquidity, and trader decision-making.",
        ],
      },
      {
        heading: "Core Framework",
        bullets: [
          "Define the market force being taught.",
          "Show how professional money would interpret it.",
          "Add a student exercise and a short quiz.",
        ],
      },
      {
        heading: "Student Outcome",
        bullets: ["Student can describe the setup, risk, invalidation, and psychology without needing a signal."],
      },
    ],
    guardrails: ["Education only; no trade signals or live execution."],
  }),
  ledger: (task) => ({
    title: "Trade Review Worksheet",
    summary: `Ledger turns "${task.command}" into a structured review for discipline, risk, and psychology.`,
    sections: [
      {
        heading: "Trade Facts",
        bullets: ["Instrument, timeframe, session, entry reason, stop, target, and outcome.", "Screenshot or chart note required before judgment."],
      },
      {
        heading: "Behavior Review",
        bullets: ["Was the trade planned or emotional?", "Was risk respected before, during, and after entry?"],
      },
      {
        heading: "Next Rule",
        bullets: ["Extract one rule to repeat and one mistake to remove from the playbook."],
      },
    ],
    guardrails: ["No revenge-trading encouragement.", "Readiness requires repeated evidence, not one result."],
  }),
  forge: (task) => ({
    title: "MT5 Bot Research Plan",
    summary: `Forge turns "${task.command}" into a validation plan before any trading claim is made.`,
    sections: [
      {
        heading: "Evidence Checklist",
        bullets: ["Source logic or strategy description.", "Symbols, timeframes, spread, commission, and modeling quality.", "In-sample and out-of-sample test windows."],
      },
      {
        heading: "Failure Diagnosis",
        bullets: ["Compare behavior against source rules.", "Check entry gates, once-per-bar logic, stops, exits, and risk sizing."],
      },
      {
        heading: "Readiness Gate",
        bullets: ["Require forward demo evidence, stress tests, and parameter stability before live use."],
      },
    ],
    guardrails: ["Requires human approval before any live-readiness claim.", "No live trading or order execution in V1."],
  }),
  voice: (task) => ({
    title: "Brand Content Draft",
    summary: `Voice turns "${task.command}" into a BIGBoss-style content asset.`,
    sections: [
      {
        heading: "Hook",
        bullets: ["Open with a market belief retail traders misunderstand.", "Make the idea specific to money movement, liquidity, or psychology."],
      },
      {
        heading: "Post Body",
        bullets: ["Teach the insight in 3 to 5 short beats.", "Avoid hype, signals, income promises, or fake certainty."],
      },
      {
        heading: "Call To Action",
        bullets: ["Invite reflection, journal review, or AI Trading College learning path."],
      },
    ],
    guardrails: ["Publishing requires human approval.", "No financial promises or performance claims."],
  }),
  scout: (task) => ({
    title: "Market Research Brief",
    summary: `Scout turns "${task.command}" into audience and trend research for the trading education business.`,
    sections: [
      {
        heading: "Audience Pain",
        bullets: ["Identify the beginner confusion, emotional cost, and repeated question.", "Separate real pain from trend noise."],
      },
      {
        heading: "Research Angles",
        bullets: ["Find teaching angles for market structure, liquidity, psychology, and macro context.", "Feed strong angles to Dean, Voice, and Launch."],
      },
      {
        heading: "Opportunity Signal",
        bullets: ["Rate whether this should become content, a lesson, an offer, or a product feature."],
      },
    ],
    guardrails: ["Research must be verified before being used as a claim."],
  }),
  launch: (task) => ({
    title: "Product Offer Plan",
    summary: `Launch turns "${task.command}" into a product, offer, or funnel draft.`,
    sections: [
      {
        heading: "Offer Promise",
        bullets: ["State the transformation without promising trading profits.", "Tie the promise to skill, process, review, or decision quality."],
      },
      {
        heading: "Package",
        bullets: ["Define modules, bonuses, support level, and delivery format.", "Map the offer to AI Trading College or BIGBoss Trader OS."],
      },
      {
        heading: "Launch Path",
        bullets: ["Draft lead magnet, landing page angle, email sequence, and approval checklist."],
      },
    ],
    guardrails: ["Pricing and public launch require human approval.", "No guaranteed income or performance promises."],
  }),
};
