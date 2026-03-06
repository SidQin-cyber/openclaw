import { RequestClient } from "@buape/carbon";
import { describe, expect, it, vi } from "vitest";

vi.mock("../config/config.js", () => ({
  loadConfig: () => ({
    channels: { discord: { proxy: "http://proxy.test:8080" } },
  }),
}));

vi.mock("./accounts.js", () => ({
  resolveDiscordAccount: () => ({
    accountId: "default",
    token: "test-token",
    config: {},
  }),
}));

vi.mock("./token.js", () => ({
  normalizeDiscordToken: (token: string | undefined) => token ?? "",
}));

describe("createDiscordRestClient proxy support", () => {
  it("returns a RequestClient with patched executeRequest when proxy is set", async () => {
    const { createDiscordRestClient } = await import("./client.js");
    const cfg = {
      channels: { discord: { proxy: "http://proxy.test:8080" } },
    } as never;
    const { rest } = createDiscordRestClient({ token: "test-token" }, cfg);
    expect(rest).toBeInstanceOf(RequestClient);
    expect(rest.executeRequest).toBeDefined();
  });

  it("returns a plain RequestClient when no proxy is set", async () => {
    const { createDiscordRestClient } = await import("./client.js");
    const cfg = { channels: { discord: {} } } as never;
    const { rest } = createDiscordRestClient({ token: "test-token" }, cfg);
    expect(rest).toBeInstanceOf(RequestClient);
  });

  it("uses provided rest client without patching", async () => {
    const { createDiscordRestClient } = await import("./client.js");
    const customRest = new RequestClient("custom");
    const cfg = {
      channels: { discord: { proxy: "http://proxy.test:8080" } },
    } as never;
    const { rest } = createDiscordRestClient({ token: "test-token", rest: customRest }, cfg);
    expect(rest).toBe(customRest);
  });
});
