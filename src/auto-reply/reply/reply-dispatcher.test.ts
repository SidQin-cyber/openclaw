import { describe, expect, it, vi } from "vitest";

vi.mock("./reply-dispatcher-registry.js", () => ({
  registerDispatcher: () => ({ unregister: () => {} }),
}));

const { createReplyDispatcher } = await import("./reply-dispatcher.js");

describe("createReplyDispatcher block reply delivery ordering (#32868)", () => {
  it("waitForIdle resolves only after deliver completes for block reply", async () => {
    const deliveryOrder: string[] = [];
    let resolveDeliver: (() => void) | undefined;
    const deliverPromise = new Promise<void>((resolve) => {
      resolveDeliver = resolve;
    });

    const dispatcher = createReplyDispatcher({
      deliver: async (_payload, _opts) => {
        deliveryOrder.push("deliver-start");
        await deliverPromise;
        deliveryOrder.push("deliver-end");
      },
    });

    dispatcher.sendBlockReply({ text: "block text" });

    const idlePromise = dispatcher.waitForIdle().then(() => {
      deliveryOrder.push("idle");
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(deliveryOrder).toEqual(["deliver-start"]);

    resolveDeliver!();
    await idlePromise;

    expect(deliveryOrder).toEqual(["deliver-start", "deliver-end", "idle"]);
    dispatcher.markComplete();
  });

  it("sequential sendBlockReply calls are delivered in order", async () => {
    const delivered: string[] = [];

    const dispatcher = createReplyDispatcher({
      deliver: async (payload) => {
        await new Promise((r) => setTimeout(r, 5));
        delivered.push((payload as { text: string }).text);
      },
    });

    dispatcher.sendBlockReply({ text: "first" });
    dispatcher.sendBlockReply({ text: "second" });
    dispatcher.sendBlockReply({ text: "third" });

    await dispatcher.waitForIdle();

    expect(delivered).toEqual(["first", "second", "third"]);
    dispatcher.markComplete();
  });
});
