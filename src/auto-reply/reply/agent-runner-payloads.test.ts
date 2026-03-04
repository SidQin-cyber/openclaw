import { describe, expect, it } from "vitest";
import { buildReplyPayloads } from "./agent-runner-payloads.js";
import { createBlockReplyPipeline } from "./block-reply-pipeline.js";

const baseParams = {
  isHeartbeat: false,
  didLogHeartbeatStrip: false,
  blockStreamingEnabled: false,
  blockReplyPipeline: null,
  replyToMode: "off" as const,
};

describe("buildReplyPayloads media filter integration", () => {
  it("strips media URL from payload when in messagingToolSentMediaUrls", () => {
    const { replyPayloads } = buildReplyPayloads({
      ...baseParams,
      payloads: [{ text: "hello", mediaUrl: "file:///tmp/photo.jpg" }],
      messagingToolSentMediaUrls: ["file:///tmp/photo.jpg"],
    });

    expect(replyPayloads).toHaveLength(1);
    expect(replyPayloads[0].mediaUrl).toBeUndefined();
  });

  it("preserves media URL when not in messagingToolSentMediaUrls", () => {
    const { replyPayloads } = buildReplyPayloads({
      ...baseParams,
      payloads: [{ text: "hello", mediaUrl: "file:///tmp/photo.jpg" }],
      messagingToolSentMediaUrls: ["file:///tmp/other.jpg"],
    });

    expect(replyPayloads).toHaveLength(1);
    expect(replyPayloads[0].mediaUrl).toBe("file:///tmp/photo.jpg");
  });

  it("applies media filter after text filter", () => {
    const { replyPayloads } = buildReplyPayloads({
      ...baseParams,
      payloads: [{ text: "hello world!", mediaUrl: "file:///tmp/photo.jpg" }],
      messagingToolSentTexts: ["hello world!"],
      messagingToolSentMediaUrls: ["file:///tmp/photo.jpg"],
    });

    // Text filter removes the payload entirely (text matched), so nothing remains.
    expect(replyPayloads).toHaveLength(0);
  });

  it("does not dedupe text for cross-target messaging sends", () => {
    const { replyPayloads } = buildReplyPayloads({
      ...baseParams,
      payloads: [{ text: "hello world!" }],
      messageProvider: "telegram",
      originatingTo: "telegram:123",
      messagingToolSentTexts: ["hello world!"],
      messagingToolSentTargets: [{ tool: "discord", provider: "discord", to: "channel:C1" }],
    });

    expect(replyPayloads).toHaveLength(1);
    expect(replyPayloads[0]?.text).toBe("hello world!");
  });

  it("does not dedupe media for cross-target messaging sends", () => {
    const { replyPayloads } = buildReplyPayloads({
      ...baseParams,
      payloads: [{ text: "photo", mediaUrl: "file:///tmp/photo.jpg" }],
      messageProvider: "telegram",
      originatingTo: "telegram:123",
      messagingToolSentMediaUrls: ["file:///tmp/photo.jpg"],
      messagingToolSentTargets: [{ tool: "slack", provider: "slack", to: "channel:C1" }],
    });

    expect(replyPayloads).toHaveLength(1);
    expect(replyPayloads[0]?.mediaUrl).toBe("file:///tmp/photo.jpg");
  });

  it("suppresses same-target replies when messageProvider is synthetic but originatingChannel is set", () => {
    const { replyPayloads } = buildReplyPayloads({
      ...baseParams,
      payloads: [{ text: "hello world!" }],
      messageProvider: "heartbeat",
      originatingChannel: "telegram",
      originatingTo: "268300329",
      messagingToolSentTexts: ["different message"],
      messagingToolSentTargets: [{ tool: "telegram", provider: "telegram", to: "268300329" }],
    });

    expect(replyPayloads).toHaveLength(0);
  });

  it("suppresses same-target replies when message tool target provider is generic", () => {
    const { replyPayloads } = buildReplyPayloads({
      ...baseParams,
      payloads: [{ text: "hello world!" }],
      messageProvider: "heartbeat",
      originatingChannel: "feishu",
      originatingTo: "ou_abc123",
      messagingToolSentTexts: ["different message"],
      messagingToolSentTargets: [{ tool: "message", provider: "message", to: "ou_abc123" }],
    });

    expect(replyPayloads).toHaveLength(0);
  });

  it("suppresses same-target replies when target provider is channel alias", () => {
    const { replyPayloads } = buildReplyPayloads({
      ...baseParams,
      payloads: [{ text: "hello world!" }],
      messageProvider: "heartbeat",
      originatingChannel: "feishu",
      originatingTo: "ou_abc123",
      messagingToolSentTexts: ["different message"],
      messagingToolSentTargets: [{ tool: "message", provider: "lark", to: "ou_abc123" }],
    });

    expect(replyPayloads).toHaveLength(0);
  });

  it("does not suppress same-target replies when accountId differs", () => {
    const { replyPayloads } = buildReplyPayloads({
      ...baseParams,
      payloads: [{ text: "hello world!" }],
      messageProvider: "heartbeat",
      originatingChannel: "telegram",
      originatingTo: "268300329",
      accountId: "personal",
      messagingToolSentTexts: ["different message"],
      messagingToolSentTargets: [
        {
          tool: "telegram",
          provider: "telegram",
          to: "268300329",
          accountId: "work",
        },
      ],
    });

    expect(replyPayloads).toHaveLength(1);
    expect(replyPayloads[0]?.text).toBe("hello world!");
  });
});

describe("block reply pipeline force-flush after abort (#34449)", () => {
  it("delivers buffered content on force-flush even after timeout abort", async () => {
    const delivered: string[] = [];
    let deliverDelay = 0;
    const pipeline = createBlockReplyPipeline({
      onBlockReply: async (payload) => {
        if (deliverDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, deliverDelay));
        }
        delivered.push(payload.text ?? "");
      },
      timeoutMs: 50,
    });

    pipeline.enqueue({ text: "chunk 1" });
    await new Promise((resolve) => setTimeout(resolve, 10));

    deliverDelay = 200;
    pipeline.enqueue({ text: "chunk 2 (will timeout)" });
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(pipeline.isAborted()).toBe(true);

    pipeline.enqueue({ text: "chunk 3 (dropped by abort)" });

    await pipeline.flush({ force: true });

    expect(delivered).toContain("chunk 1");
  });

  it("does not deliver new enqueue calls after abort without force-flush", async () => {
    const delivered: string[] = [];
    const pipeline = createBlockReplyPipeline({
      onBlockReply: async (payload) => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        delivered.push(payload.text ?? "");
      },
      timeoutMs: 50,
    });

    pipeline.enqueue({ text: "chunk 1 (will timeout)" });
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(pipeline.isAborted()).toBe(true);

    pipeline.enqueue({ text: "chunk 2 (should be dropped)" });
    await pipeline.flush();

    expect(delivered).not.toContain("chunk 2 (should be dropped)");
  });
});
