// Node-only filesystem store for durable shared memory.
// Writes one Markdown note per memory entry into <root>/<folderId>/<slug>.md so the
// memory is durable on disk and browsable/linkable in an Obsidian vault.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  isMemoryFolderId,
  memoryFolderIds,
  type DurableMemoryEntry,
  type DurableMemoryFolderId,
} from "../domain/durableMemory";

export interface MemoryStoreOptions {
  root: string;
}

export interface MemoryStore {
  baseDir: string;
  writeEntry: (entry: DurableMemoryEntry) => { path: string };
  listEntries: () => DurableMemoryEntry[];
}

export function createMemoryStore({ root }: MemoryStoreOptions): MemoryStore {
  const baseDir = resolve(root);

  function folderDir(folderId: DurableMemoryFolderId): string {
    return join(baseDir, folderId);
  }

  function writeEntry(entry: DurableMemoryEntry): { path: string } {
    if (!isMemoryFolderId(entry.folderId)) {
      throw new Error(`Unknown memory folder: ${entry.folderId}`);
    }

    const dir = folderDir(entry.folderId);
    const filePath = join(dir, `${safeSlug(entry.id)}.md`);

    // Path-safety: never write outside the configured memory root.
    if (!resolve(filePath).startsWith(baseDir)) {
      throw new Error("Refusing to write outside the memory root.");
    }

    mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, renderMarkdown(entry), "utf8");
    return { path: filePath };
  }

  function listEntries(): DurableMemoryEntry[] {
    const entries: DurableMemoryEntry[] = [];

    for (const folderId of memoryFolderIds) {
      const dir = folderDir(folderId);
      if (!existsSync(dir)) continue;

      for (const file of readdirSync(dir)) {
        if (!file.endsWith(".md")) continue;
        const parsed = parseMarkdown(readFileSync(join(dir, file), "utf8"));
        if (parsed) entries.push(parsed);
      }
    }

    return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return { baseDir, writeEntry, listEntries };
}

export function safeSlug(raw: string): string {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "entry";
}

export function renderMarkdown(entry: DurableMemoryEntry): string {
  const tags = entry.tags?.length ? `[${entry.tags.join(", ")}]` : "[]";
  const frontmatter = [
    "---",
    `id: ${entry.id}`,
    "type: memory",
    `folderId: ${entry.folderId}`,
    `agentId: ${entry.agentId}`,
    `sourceTaskId: ${entry.sourceTaskId}`,
    `createdAt: ${entry.createdAt}`,
    `tags: ${tags}`,
    "---",
  ].join("\n");

  return `${frontmatter}\n\n# ${entry.title}\n\n${entry.summary}\n`;
}

export function parseMarkdown(raw: string): DurableMemoryEntry | null {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (!match) return null;

  const fields = parseFrontmatter(match[1]);
  const folderId = fields.folderId;
  if (!folderId || !isMemoryFolderId(folderId)) return null;

  const body = match[2].trim();
  const titleMatch = /^#\s+(.+)$/m.exec(body);
  const title = titleMatch ? titleMatch[1].trim() : fields.id ?? "Untitled";
  const summary = body
    .replace(/^#\s+.+$/m, "")
    .trim();

  return {
    id: fields.id ?? title,
    folderId,
    title,
    summary,
    agentId: fields.agentId ?? "",
    sourceTaskId: fields.sourceTaskId ?? "",
    createdAt: fields.createdAt ?? new Date(0).toISOString(),
    tags: parseTags(fields.tags),
  };
}

function parseFrontmatter(block: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) fields[key] = value;
  }
  return fields;
}

function parseTags(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const inner = raw.replace(/^\[|\]$/g, "").trim();
  if (!inner) return undefined;
  return inner
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
