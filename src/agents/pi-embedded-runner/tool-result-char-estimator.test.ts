import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";
import {
  estimateMessageCharsCached,
  createMessageCharEstimateCache,
  getToolResultText,
  isToolResultMessage,
} from "./tool-result-char-estimator.js";

describe("isToolResultMessage", () => {
  it("identifies toolResult role", () => {
    expect(isToolResultMessage({ role: "toolResult" } as AgentMessage)).toBe(true);
  });

  it("identifies tool role", () => {
    expect(isToolResultMessage({ role: "tool" } as AgentMessage)).toBe(true);
  });

  it("rejects assistant role", () => {
    expect(isToolResultMessage({ role: "assistant" } as AgentMessage)).toBe(false);
  });
});

describe("getToolResultText", () => {
  it("extracts text from valid tool result", () => {
    const msg = {
      role: "toolResult",
      content: [{ type: "text", text: "hello" }],
    } as AgentMessage;
    expect(getToolResultText(msg)).toBe("hello");
  });

  it("handles malformed text block missing text property", () => {
    const msg = {
      role: "toolResult",
      content: [{ type: "text" }],
    } as AgentMessage;
    expect(getToolResultText(msg)).toBe("");
  });

  it("handles text block with non-string text", () => {
    const msg = {
      role: "toolResult",
      content: [{ type: "text", text: 42 }],
    } as AgentMessage;
    expect(getToolResultText(msg)).toBe("");
  });

  it("handles null content block", () => {
    const msg = {
      role: "toolResult",
      content: [null, { type: "text", text: "ok" }],
    } as AgentMessage;
    expect(getToolResultText(msg)).toBe("ok");
  });
});

describe("estimateMessageCharsCached", () => {
  it("does not crash on malformed text block in tool result", () => {
    const cache = createMessageCharEstimateCache();
    const msg = {
      role: "toolResult",
      content: [{ type: "text" }, { type: "text", text: "valid" }],
    } as AgentMessage;
    const estimate = estimateMessageCharsCached(msg, cache);
    expect(estimate).toBeGreaterThanOrEqual(5);
  });

  it("does not crash on malformed text block in user message", () => {
    const cache = createMessageCharEstimateCache();
    const msg = {
      role: "user",
      content: [{ type: "text" }],
    } as AgentMessage;
    const estimate = estimateMessageCharsCached(msg, cache);
    expect(estimate).toBeGreaterThanOrEqual(0);
  });
});
