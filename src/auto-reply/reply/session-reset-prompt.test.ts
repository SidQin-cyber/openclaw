import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { buildBareSessionResetPrompt, readStartupSection } from "./session-reset-prompt.js";

describe("buildBareSessionResetPrompt", () => {
  it("includes the core session startup instruction", () => {
    const prompt = buildBareSessionResetPrompt();
    expect(prompt).toContain("Execute your Session Startup sequence now");
    expect(prompt).toContain("read the required files before responding to the user");
  });

  it("appends current time line so agents know the date", () => {
    const cfg = {
      agents: { defaults: { userTimezone: "America/New_York", timeFormat: "12" } },
    } as OpenClawConfig;
    // 2026-03-03 14:00 UTC = 2026-03-03 09:00 EST
    const nowMs = Date.UTC(2026, 2, 3, 14, 0, 0);
    const prompt = buildBareSessionResetPrompt(cfg, nowMs);
    expect(prompt).toContain(
      "Current time: Tuesday, March 3rd, 2026 — 9:00 AM (America/New_York) / 2026-03-03 14:00 UTC",
    );
  });

  it("does not append a duplicate current time line", () => {
    const nowMs = Date.UTC(2026, 2, 3, 14, 0, 0);
    const prompt = buildBareSessionResetPrompt(undefined, nowMs);
    expect((prompt.match(/Current time:/g) ?? []).length).toBe(1);
  });

  it("falls back to UTC when no timezone configured", () => {
    const nowMs = Date.UTC(2026, 2, 3, 14, 0, 0);
    const prompt = buildBareSessionResetPrompt(undefined, nowMs);
    expect(prompt).toContain("Current time:");
  });

  it("inlines startup section when provided", () => {
    const section =
      "## Session Startup\n\n1. Read /workspace/BOOTSTRAP.md\n2. Read /workspace/persona.md";
    const prompt = buildBareSessionResetPrompt(undefined, undefined, section);
    expect(prompt).toContain("Your Session Startup instructions from AGENTS.md:");
    expect(prompt).toContain("Read /workspace/BOOTSTRAP.md");
    expect(prompt).toContain("Read /workspace/persona.md");
    expect(prompt).toContain("Execute your Session Startup sequence now");
  });

  it("does not include startup section header when no section provided", () => {
    const prompt = buildBareSessionResetPrompt();
    expect(prompt).not.toContain("Your Session Startup instructions from AGENTS.md:");
  });
});

describe("readStartupSection", () => {
  function makeTmpWorkspace(agentsMd: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reset-prompt-test-"));
    fs.writeFileSync(path.join(dir, "AGENTS.md"), agentsMd, "utf-8");
    return dir;
  }

  it("extracts Session Startup section from AGENTS.md", () => {
    const dir = makeTmpWorkspace(
      "# Agent\n\n## Session Startup\n\n1. Read BOOTSTRAP.md\n2. Greet user\n\n## Red Lines\n\nDo not lie.\n",
    );
    const section = readStartupSection(dir);
    expect(section).toBeDefined();
    expect(section).toContain("Read BOOTSTRAP.md");
    expect(section).not.toContain("Do not lie");
  });

  it("returns undefined when no AGENTS.md exists", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reset-prompt-test-"));
    const section = readStartupSection(dir);
    expect(section).toBeUndefined();
  });

  it("returns undefined when AGENTS.md has no Session Startup section", () => {
    const dir = makeTmpWorkspace("# Agent\n\n## Red Lines\n\nDo not lie.\n");
    const section = readStartupSection(dir);
    expect(section).toBeUndefined();
  });

  it("falls back to Every Session legacy name", () => {
    const dir = makeTmpWorkspace("# Agent\n\n## Every Session\n\n1. Read config.md\n");
    const section = readStartupSection(dir);
    expect(section).toBeDefined();
    expect(section).toContain("Read config.md");
  });
});
