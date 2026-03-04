import { afterEach, describe, expect, it, vi } from "vitest";
import { createGatewayCloseHandler } from "./server-close.js";

function stubParams(overrides: Partial<Parameters<typeof createGatewayCloseHandler>[0]> = {}) {
  const wss = { close: (cb: () => void) => cb() };
  const httpServer = {
    close: (cb: (err?: Error) => void) => cb(),
    closeIdleConnections: vi.fn(),
  };
  return {
    bonjourStop: null,
    tailscaleCleanup: null,
    canvasHost: null,
    canvasHostServer: null,
    stopChannel: vi.fn(async () => {}),
    pluginServices: null,
    cron: { stop: vi.fn() },
    heartbeatRunner: { stop: vi.fn() },
    updateCheckStop: null,
    nodePresenceTimers: new Map(),
    broadcast: vi.fn(),
    tickInterval: setInterval(() => {}, 1e9),
    healthInterval: setInterval(() => {}, 1e9),
    dedupeCleanup: setInterval(() => {}, 1e9),
    agentUnsub: null,
    heartbeatUnsub: null,
    chatRunState: { clear: vi.fn() },
    clients: new Set<{ socket: { close: (code: number, reason: string) => void } }>(),
    configReloader: { stop: vi.fn(async () => {}) },
    browserControl: null,
    wss: wss as unknown as Parameters<typeof createGatewayCloseHandler>[0]["wss"],
    httpServer: httpServer as unknown as Parameters<
      typeof createGatewayCloseHandler
    >[0]["httpServer"],
    ...overrides,
  } satisfies Parameters<typeof createGatewayCloseHandler>[0];
}

vi.mock("../channels/plugins/index.js", () => ({
  listChannelPlugins: () => [],
}));
vi.mock("../hooks/gmail-watcher.js", () => ({
  stopGmailWatcher: vi.fn(async () => {}),
}));

describe("createGatewayCloseHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls bonjourStop when provided", async () => {
    const bonjourStop = vi.fn(async () => {});
    const params = stubParams({ bonjourStop });
    const close = createGatewayCloseHandler(params);

    await close();

    expect(bonjourStop).toHaveBeenCalledTimes(1);
  });

  it("waits ≥200ms after bonjourStop for mDNS goodbye propagation (#33609)", async () => {
    const bonjourStop = vi.fn(async () => {});
    const params = stubParams({ bonjourStop });
    const close = createGatewayCloseHandler(params);

    const start = performance.now();
    await close();
    const elapsed = performance.now() - start;

    expect(bonjourStop).toHaveBeenCalledTimes(1);
    expect(elapsed).toBeGreaterThanOrEqual(180);
  });

  it("does not delay when bonjourStop is null", async () => {
    const params = stubParams({ bonjourStop: null });
    const close = createGatewayCloseHandler(params);

    const start = performance.now();
    await close();
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(180);
  });

  it("still delays even if bonjourStop throws", async () => {
    const bonjourStop = vi.fn(async () => {
      throw new Error("destroy failed");
    });
    const params = stubParams({ bonjourStop });
    const close = createGatewayCloseHandler(params);

    const start = performance.now();
    await close();
    const elapsed = performance.now() - start;

    expect(bonjourStop).toHaveBeenCalledTimes(1);
    expect(elapsed).toBeGreaterThanOrEqual(180);
  });
});
