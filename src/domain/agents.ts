export type AgentId = "dean" | "ledger" | "forge" | "voice" | "scout" | "launch";

export type RiskLevel = "low" | "medium" | "high";

export interface Agent {
  id: AgentId;
  name: string;
  title: string;
  mission: string;
  responsibilities: string[];
}

export const agents: Agent[] = [
  {
    id: "dean",
    name: "Dean",
    title: "AI Trading College",
    mission: "Build lessons, curriculum paths, quizzes, and student explanations.",
    responsibilities: ["Lessons", "Curriculum", "Quizzes", "Student explanations"],
  },
  {
    id: "ledger",
    name: "Ledger",
    title: "Trade Review",
    mission: "Review trades, journal behavior, risk, psychology, and readiness.",
    responsibilities: ["Trade journals", "Risk behavior", "Psychology", "Readiness gates"],
  },
  {
    id: "forge",
    name: "Forge",
    title: "Bot Research",
    mission: "Plan MT5 validation, Pine-to-MT5 diagnosis, backtests, and bot comparisons.",
    responsibilities: ["MT5 bots", "Backtests", "Pine conversions", "Evidence summaries"],
  },
  {
    id: "voice",
    name: "Voice",
    title: "Brand Content",
    mission: "Create brand voice content for LinkedIn, Substack, YouTube, email, and communities.",
    responsibilities: ["LinkedIn", "Substack", "YouTube scripts", "Emails"],
  },
  {
    id: "scout",
    name: "Scout",
    title: "Market Research",
    mission: "Find audience pain points, trends, research angles, and product opportunities.",
    responsibilities: ["Pain points", "Trends", "Audience questions", "Offer angles"],
  },
  {
    id: "launch",
    name: "Launch",
    title: "Product Engine",
    mission: "Build offers, funnels, pricing, sales pages, and launch plans.",
    responsibilities: ["Offers", "Funnels", "Pricing", "Lead magnets"],
  },
];

export const productVault = [
  "AI Trading College",
  "BIGBoss Trader OS",
  "Market Structure Lessons",
  "Trade Review System",
  "MT5 Bot Research Lab",
  "Content and Launch Engine",
];
