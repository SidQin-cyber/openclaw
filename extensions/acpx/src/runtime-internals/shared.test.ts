import { describe, expect, it } from "vitest";
import { resolveAcpxSubcommand } from "./shared.js";

describe("resolveAcpxSubcommand", () => {
  it.each([
    ["openai-codex", "codex"],
    ["codex-cli", "codex"],
    ["codex", "codex"],
    ["claude-code", "claude"],
    ["claudecode", "claude"],
    ["claude", "claude"],
    ["moonshot-kimi", "kimi"],
    ["kimi", "kimi"],
    ["gemini", "gemini"],
    ["opencode", "opencode"],
    ["pi", "pi"],
  ])("maps %s → %s", (input, expected) => {
    expect(resolveAcpxSubcommand(input)).toBe(expected);
  });

  it("normalizes case and whitespace", () => {
    expect(resolveAcpxSubcommand("OpenAI-Codex")).toBe("codex");
    expect(resolveAcpxSubcommand("  Claude-Code  ")).toBe("claude");
    expect(resolveAcpxSubcommand("Moonshot_Kimi")).toBe("kimi");
  });

  it("passes through unknown agent ids unchanged", () => {
    expect(resolveAcpxSubcommand("my-custom-agent")).toBe("my-custom-agent");
    expect(resolveAcpxSubcommand("local-llama")).toBe("local-llama");
  });
});
