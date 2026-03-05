import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../../config/config.js";
import { writeWorkspaceFile } from "../../../test-helpers/workspace.js";
import type { HookHandler } from "../../hooks.js";
import { createHookEvent } from "../../hooks.js";

const generateSlugViaLLM = vi.fn().mockResolvedValue("llm-slug");

vi.mock("../../llm-slug-generator.js", () => ({
  generateSlugViaLLM: (...args: unknown[]) => generateSlugViaLLM(...args),
}));

let handler: HookHandler;
let suiteWorkspaceRoot = "";
let caseCounter = 0;

async function createCaseWorkspace(): Promise<string> {
  const dir = path.join(suiteWorkspaceRoot, `slug-case-${caseCounter}`);
  caseCounter += 1;
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function createMockSessionContent(): string {
  return [
    JSON.stringify({
      type: "message",
      message: { role: "user", content: "Hello" },
    }),
    JSON.stringify({
      type: "message",
      message: { role: "assistant", content: "Hi there!" },
    }),
  ].join("\n");
}

beforeAll(async () => {
  ({ default: handler } = await import("./handler.js"));
  suiteWorkspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-slug-mode-"));
});

afterAll(async () => {
  await fs.rm(suiteWorkspaceRoot, { recursive: true, force: true }).catch(() => {});
});

async function runSlugTest(
  workspace: string,
  cfg: OpenClawConfig,
): Promise<string[]> {
  const sessionsDir = path.join(workspace, "sessions");
  await fs.mkdir(sessionsDir, { recursive: true });

  const sessionFile = await writeWorkspaceFile({
    dir: sessionsDir,
    name: "test-session.jsonl",
    content: createMockSessionContent(),
  });

  const event = createHookEvent("command", "new", "agent:main:main", {
    cfg,
    previousSessionEntry: {
      sessionId: "test-session",
      sessionFile,
    },
  });

  await handler(event);

  const memoryDir = path.join(workspace, "memory");
  return fs.readdir(memoryDir).catch(() => []);
}

describe("session-memory slug mode config (#35289)", () => {
  it("uses timestamp fallback in test env when slugMode is default (VITEST blocks LLM)", async () => {
    generateSlugViaLLM.mockClear();
    const workspace = await createCaseWorkspace();
    const cfg = { agents: { defaults: { workspace } } } as OpenClawConfig;
    const files = await runSlugTest(workspace, cfg);

    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^\d{4}-\d{2}-\d{2}-\d{4}\.md$/);
  });

  it("skips LLM entirely and uses full HHMMSS timestamp when slugMode is 'timestamp'", async () => {
    generateSlugViaLLM.mockClear();
    const workspace = await createCaseWorkspace();
    const cfg = {
      agents: { defaults: { workspace } },
      memory: { slugMode: "timestamp" },
    } as OpenClawConfig;
    const files = await runSlugTest(workspace, cfg);

    expect(generateSlugViaLLM).not.toHaveBeenCalled();
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^\d{4}-\d{2}-\d{2}-\d{6}\.md$/);
  });

  it("slugMode 'timestamp' produces longer filename than default HHMM fallback", async () => {
    const ws1 = await createCaseWorkspace();
    const ws2 = await createCaseWorkspace();

    const cfgDefault = { agents: { defaults: { workspace: ws1 } } } as OpenClawConfig;
    const cfgTs = {
      agents: { defaults: { workspace: ws2 } },
      memory: { slugMode: "timestamp" },
    } as OpenClawConfig;

    const [defaultFiles, tsFiles] = await Promise.all([
      runSlugTest(ws1, cfgDefault),
      runSlugTest(ws2, cfgTs),
    ]);

    const defaultSlug = defaultFiles[0]?.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(".md", "");
    const tsSlug = tsFiles[0]?.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(".md", "");
    expect(defaultSlug?.length).toBe(4); // HHMM
    expect(tsSlug?.length).toBe(6); // HHMMSS
  });
});
