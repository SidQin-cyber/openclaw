import type { StreamFn } from "@mariozechner/pi-agent-core";
import type { Context, Model } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import { applyExtraParamsToAgent } from "./extra-params.js";

function buildHarness(provider: string, modelId: string) {
  const payloads: Record<string, unknown>[] = [];

  const baseStreamFn: StreamFn = (_model, _context, options) => {
    const payload: Record<string, unknown> = {
      ...basePayloadSeed,
    };
    options?.onPayload?.(payload);
    payloads.push(payload);
    return {} as ReturnType<StreamFn>;
  };

  let basePayloadSeed: Record<string, unknown> | undefined;

  const agent = { streamFn: baseStreamFn };
  applyExtraParamsToAgent(agent, undefined, provider, modelId);

  const model = {
    api: "anthropic-messages",
    provider,
    id: modelId,
  } as Model<"anthropic-messages">;
  const context: Context = { messages: [] };

  return {
    run(toolChoice?: unknown) {
      payloads.length = 0;
      basePayloadSeed = toolChoice !== undefined ? { tool_choice: toolChoice } : {};
      void agent.streamFn?.(model, context, {});
      return payloads[0];
    },
  };
}

describe("MiniMax tool_choice normalization", () => {
  it('normalizes tool_choice "required" to "auto" for minimax provider', () => {
    const h = buildHarness("minimax", "MiniMax-M2.5");
    const p = h.run("required");
    expect(p?.tool_choice).toBe("auto");
  });

  it('normalizes tool_choice { type: "tool", name: "exec" } to "auto"', () => {
    const h = buildHarness("minimax", "MiniMax-M2.5");
    const p = h.run({ type: "tool", name: "exec" });
    expect(p?.tool_choice).toBe("auto");
  });

  it('preserves tool_choice "auto"', () => {
    const h = buildHarness("minimax", "MiniMax-M2.5");
    const p = h.run("auto");
    expect(p?.tool_choice).toBe("auto");
  });

  it('preserves tool_choice "none"', () => {
    const h = buildHarness("minimax", "MiniMax-M2.5");
    const p = h.run("none");
    expect(p?.tool_choice).toBe("none");
  });

  it('preserves tool_choice { type: "auto" }', () => {
    const h = buildHarness("minimax", "MiniMax-M2.5");
    const p = h.run({ type: "auto" });
    expect(p?.tool_choice).toEqual({ type: "auto" });
  });

  it("preserves null tool_choice", () => {
    const h = buildHarness("minimax", "MiniMax-M2.5");
    const p = h.run(null);
    expect(p?.tool_choice).toBeNull();
  });

  it("applies to minimax-cn provider", () => {
    const h = buildHarness("minimax-cn", "MiniMax-M2.5");
    const p = h.run("required");
    expect(p?.tool_choice).toBe("auto");
  });

  it("applies to minimax-portal provider", () => {
    const h = buildHarness("minimax-portal", "MiniMax-M2.5");
    const p = h.run("required");
    expect(p?.tool_choice).toBe("auto");
  });

  it("does not apply to non-minimax providers", () => {
    const h = buildHarness("anthropic", "claude-sonnet-4-5");
    const p = h.run("required");
    expect(p?.tool_choice).toBe("required");
  });
});
