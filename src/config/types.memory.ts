import type { SessionSendPolicyConfig } from "./types.base.js";

export type MemoryBackend = "builtin" | "qmd";
export type MemoryCitationsMode = "auto" | "on" | "off";
export type MemoryQmdSearchMode = "query" | "search" | "vsearch";

export type MemorySlugMode = "llm" | "timestamp";

export type MemoryConfig = {
  backend?: MemoryBackend;
  citations?: MemoryCitationsMode;
  qmd?: MemoryQmdConfig;
  /**
   * How session-memory filenames (slugs) are generated.
   * - "llm" (default): uses a lightweight LLM call to produce a 1–2 word slug.
   * - "timestamp": skips the LLM call entirely and uses YYYY-MM-DD-HHMMSS.
   */
  slugMode?: MemorySlugMode;
  /**
   * Override the model used for LLM-based slug generation.
   * Accepts "provider/model" format (e.g. "openrouter/google/gemini-flash-2.0").
   * When unset, the agent's primary model is used — which may waste RPM on
   * expensive frontier models for a trivial text task.
   */
  slugModel?: string;
};

export type MemoryQmdConfig = {
  command?: string;
  mcporter?: MemoryQmdMcporterConfig;
  searchMode?: MemoryQmdSearchMode;
  includeDefaultMemory?: boolean;
  paths?: MemoryQmdIndexPath[];
  sessions?: MemoryQmdSessionConfig;
  update?: MemoryQmdUpdateConfig;
  limits?: MemoryQmdLimitsConfig;
  scope?: SessionSendPolicyConfig;
};

export type MemoryQmdMcporterConfig = {
  /**
   * Route QMD searches through mcporter (MCP runtime) instead of spawning `qmd` per query.
   * Requires:
   * - `mcporter` installed and on PATH
   * - A configured mcporter server that runs `qmd mcp` with `lifecycle: keep-alive`
   */
  enabled?: boolean;
  /** mcporter server name (defaults to "qmd") */
  serverName?: string;
  /** Start the mcporter daemon automatically (defaults to true when enabled). */
  startDaemon?: boolean;
};

export type MemoryQmdIndexPath = {
  path: string;
  name?: string;
  pattern?: string;
};

export type MemoryQmdSessionConfig = {
  enabled?: boolean;
  exportDir?: string;
  retentionDays?: number;
};

export type MemoryQmdUpdateConfig = {
  interval?: string;
  debounceMs?: number;
  onBoot?: boolean;
  waitForBootSync?: boolean;
  embedInterval?: string;
  commandTimeoutMs?: number;
  updateTimeoutMs?: number;
  embedTimeoutMs?: number;
};

export type MemoryQmdLimitsConfig = {
  maxResults?: number;
  maxSnippetChars?: number;
  maxInjectedChars?: number;
  timeoutMs?: number;
};
