import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";
import { pruneContextMessages } from "./pruner.js";
import { DEFAULT_CONTEXT_PRUNING_SETTINGS } from "./settings.js";

const MODEL = { contextWindow: 1_000_000 };

describe("pruneContextMessages", () => {
  it("does not crash on assistant message with malformed thinking block (missing thinking string)", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "hello" },
      {
        role: "assistant",
        content: [{ type: "thinking" } as never, { type: "text", text: "ok" }],
      },
    ];
    expect(() =>
      pruneContextMessages({
        messages,
        settings: DEFAULT_CONTEXT_PRUNING_SETTINGS,
        ctx: { model: MODEL },
      }),
    ).not.toThrow();
  });

  it("does not crash on assistant message with null content entries", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "hello" },
      {
        role: "assistant",
        content: [null as never, { type: "text", text: "world" }],
      },
    ];
    expect(() =>
      pruneContextMessages({
        messages,
        settings: DEFAULT_CONTEXT_PRUNING_SETTINGS,
        ctx: { model: MODEL },
      }),
    ).not.toThrow();
  });

  it("handles well-formed thinking blocks correctly", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "hello" },
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "let me think" },
          { type: "text", text: "here is the answer" },
        ],
      },
    ];
    const result = pruneContextMessages({
      messages,
      settings: DEFAULT_CONTEXT_PRUNING_SETTINGS,
      ctx: { model: MODEL },
    });
    expect(result).toHaveLength(2);
  });
});
