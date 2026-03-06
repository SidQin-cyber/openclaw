import fs from "node:fs";
import path from "node:path";
import { appendCronStyleCurrentTimeLine } from "../../agents/current-time.js";
import type { OpenClawConfig } from "../../config/config.js";
import { openBoundaryFileSync } from "../../infra/boundary-file-read.js";
import { extractSections } from "./post-compaction-context.js";

const BARE_SESSION_RESET_PROMPT_BASE =
  "A new session was started via /new or /reset. Execute your Session Startup sequence now - read the required files before responding to the user. Then greet the user in your configured persona, if one is provided. Be yourself - use your defined voice, mannerisms, and mood. Keep it to 1-3 sentences and ask what they want to do. If the runtime model differs from default_model in the system prompt, mention the default model. Do not mention internal steps, files, tools, or reasoning.";

const MAX_STARTUP_SECTION_CHARS = 3000;

/**
 * Read the "## Session Startup" section from AGENTS.md in the workspace.
 * Returns the section content or undefined if not found / unreadable.
 */
export function readStartupSection(workspaceDir: string): string | undefined {
  const agentsPath = path.join(workspaceDir, "AGENTS.md");
  try {
    const opened = openBoundaryFileSync({
      absolutePath: agentsPath,
      rootPath: workspaceDir,
      boundaryLabel: "workspace root",
    });
    if (!opened.ok) {
      return undefined;
    }
    let content: string;
    try {
      content = fs.readFileSync(opened.fd, "utf-8");
    } finally {
      fs.closeSync(opened.fd);
    }
    let sections = extractSections(content, ["Session Startup"]);
    if (sections.length === 0) {
      sections = extractSections(content, ["Every Session"]);
    }
    if (sections.length === 0) {
      return undefined;
    }
    const combined = sections.join("\n\n");
    return combined.length > MAX_STARTUP_SECTION_CHARS
      ? combined.slice(0, MAX_STARTUP_SECTION_CHARS) + "\n...[truncated]..."
      : combined;
  } catch {
    return undefined;
  }
}

/**
 * Build the bare session reset prompt, appending the current date/time so agents
 * know which daily memory files to read during their Session Startup sequence.
 * Without this, agents on /new or /reset guess the date from their training cutoff.
 *
 * When `startupSection` is provided (extracted from AGENTS.md), it is inlined
 * into the prompt so the model has concrete file paths instead of hallucinating
 * them from training data.
 */
export function buildBareSessionResetPrompt(
  cfg?: OpenClawConfig,
  nowMs?: number,
  startupSection?: string,
): string {
  const base = startupSection
    ? `${BARE_SESSION_RESET_PROMPT_BASE}\n\nYour Session Startup instructions from AGENTS.md:\n\n${startupSection}`
    : BARE_SESSION_RESET_PROMPT_BASE;
  return appendCronStyleCurrentTimeLine(base, cfg ?? {}, nowMs ?? Date.now());
}

/** @deprecated Use buildBareSessionResetPrompt(cfg) instead */
export const BARE_SESSION_RESET_PROMPT = BARE_SESSION_RESET_PROMPT_BASE;
