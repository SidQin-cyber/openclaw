import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInlineCodeState } from "../markdown/code-spans.js";
import { handleAgentEnd } from "./pi-embedded-subscribe.handlers.lifecycle.js";
import type { EmbeddedPiSubscribeContext } from "./pi-embedded-subscribe.handlers.types.js";

vi.mock("../infra/agent-events.js", () => ({
  emitAgentEvent: vi.fn(),
}));

function createContext(
  lastAssistant: unknown,
  overrides?: {
    onAgentEvent?: (event: unknown) => void;
    getUsageTotals?: () => unknown;
  },
): EmbeddedPiSubscribeContext {
  return {
    params: {
      runId: "run-1",
      config: {},
      sessionKey: "agent:main:main",
      onAgentEvent: overrides?.onAgentEvent,
    },
    state: {
      lastAssistant: lastAssistant as EmbeddedPiSubscribeContext["state"]["lastAssistant"],
      pendingCompactionRetry: 0,
      blockState: {
        thinking: true,
        final: true,
        inlineCode: createInlineCodeState(),
      },
    },
    log: {
      debug: vi.fn(),
      warn: vi.fn(),
    },
    flushBlockReplyBuffer: vi.fn(),
    resolveCompactionRetry: vi.fn(),
    maybeResolveCompactionWait: vi.fn(),
    getUsageTotals: overrides?.getUsageTotals ?? (() => undefined),
  } as unknown as EmbeddedPiSubscribeContext;
}

describe("handleAgentEnd", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs the resolved error message when run ends with assistant error", () => {
    const onAgentEvent = vi.fn();
    const ctx = createContext(
      {
        role: "assistant",
        stopReason: "error",
        errorMessage: "connection refused",
        content: [{ type: "text", text: "" }],
      },
      { onAgentEvent },
    );

    handleAgentEnd(ctx);

    const warn = vi.mocked(ctx.log.warn);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("runId=run-1");
    expect(warn.mock.calls[0]?.[0]).toContain("error=connection refused");
    expect(onAgentEvent).toHaveBeenCalledWith({
      stream: "lifecycle",
      data: {
        phase: "error",
        error: "connection refused",
      },
    });
  });

  it("keeps non-error run-end logging on debug only", () => {
    const ctx = createContext(undefined);

    handleAgentEnd(ctx);

    expect(ctx.log.warn).not.toHaveBeenCalled();
    expect(ctx.log.debug).toHaveBeenCalledWith("embedded run agent end: runId=run-1 isError=false");
  });

  it("includes usage totals in lifecycle end event when available", async () => {
    const { emitAgentEvent } = await import("../infra/agent-events.js");
    const onAgentEvent = vi.fn();
    const usage = { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, total: 150 };
    const ctx = createContext(undefined, {
      onAgentEvent,
      getUsageTotals: () => usage,
    });

    handleAgentEnd(ctx);

    const calls = vi.mocked(emitAgentEvent).mock.calls;
    const endCall = calls.find(
      (c) => (c[0] as { data?: { phase?: string } }).data?.phase === "end",
    );
    expect(endCall).toBeDefined();
    expect((endCall![0] as { data: { usage?: unknown } }).data.usage).toEqual(usage);

    expect(onAgentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phase: "end", usage }),
      }),
    );
  });

  it("omits usage from lifecycle end event when no usage data", async () => {
    const { emitAgentEvent } = await import("../infra/agent-events.js");
    const ctx = createContext(undefined);

    handleAgentEnd(ctx);

    const calls = vi.mocked(emitAgentEvent).mock.calls;
    const endCall = calls.find(
      (c) => (c[0] as { data?: { phase?: string } }).data?.phase === "end",
    );
    expect(endCall).toBeDefined();
    expect((endCall![0] as { data: Record<string, unknown> }).data).not.toHaveProperty("usage");
  });
});
