import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMemoryStore, parseMarkdown, renderMarkdown, safeSlug } from "./memoryStore";
import type { DurableMemoryEntry } from "../domain/durableMemory";

function makeEntry(overrides: Partial<DurableMemoryEntry> = {}): DurableMemoryEntry {
  return {
    id: "memory-forge-2026-06-20T00:00:00.000Z",
    folderId: "evidence",
    title: "Forge routed bot research",
    summary: "Backtest this MT5 bot and tell me if it is live ready.",
    agentId: "forge",
    sourceTaskId: "forge-2026-06-20T00:00:00.000Z",
    createdAt: "2026-06-20T00:00:00.000Z",
    tags: ["bot_research", "forge"],
    ...overrides,
  };
}

describe("memoryStore", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "bigboss-memory-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("writes an entry into a folder-named subdirectory and reads it back", () => {
    const store = createMemoryStore({ root });
    const { path } = store.writeEntry(makeEntry());

    expect(path).toContain(join(root, "evidence"));
    expect(readFileSync(path, "utf8")).toContain("folderId: evidence");

    const entries = store.listEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      folderId: "evidence",
      agentId: "forge",
      title: "Forge routed bot research",
      tags: ["bot_research", "forge"],
    });
  });

  it("lists entries across folders newest-first", () => {
    const store = createMemoryStore({ root });
    store.writeEntry(makeEntry({ id: "older", createdAt: "2026-06-01T00:00:00.000Z", folderId: "tasks" }));
    store.writeEntry(makeEntry({ id: "newer", createdAt: "2026-06-20T00:00:00.000Z", folderId: "organization" }));

    const entries = store.listEntries();
    expect(entries.map((entry) => entry.id)).toEqual(["newer", "older"]);
  });

  it("rejects unknown memory folders", () => {
    const store = createMemoryStore({ root });
    expect(() => store.writeEntry(makeEntry({ folderId: "bogus" as never }))).toThrow(/Unknown memory folder/);
  });

  it("returns an empty list when no memory has been written yet", () => {
    const store = createMemoryStore({ root });
    expect(store.listEntries()).toEqual([]);
  });

  it("round-trips through render and parse", () => {
    const entry = makeEntry();
    const parsed = parseMarkdown(renderMarkdown(entry));
    expect(parsed).toMatchObject({
      id: entry.id,
      folderId: entry.folderId,
      title: entry.title,
      summary: entry.summary,
      agentId: entry.agentId,
      tags: entry.tags,
    });
  });

  it("sanitizes ids into safe filenames", () => {
    expect(safeSlug("forge-2026-06-20T00:00:00.000Z")).toBe("forge-2026-06-20t00-00-00-000z");
    expect(safeSlug("../../etc/passwd")).toBe("etc-passwd");
    expect(safeSlug("")).toBe("entry");
  });
});
