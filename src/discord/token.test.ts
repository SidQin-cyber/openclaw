import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { isDiscordTokenConfigured, resolveDiscordToken } from "./token.js";

describe("resolveDiscordToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers config token over env", () => {
    vi.stubEnv("DISCORD_BOT_TOKEN", "env-token");
    const cfg = {
      channels: { discord: { token: "cfg-token" } },
    } as OpenClawConfig;
    const res = resolveDiscordToken(cfg);
    expect(res.token).toBe("cfg-token");
    expect(res.source).toBe("config");
  });

  it("uses env token when config is missing", () => {
    vi.stubEnv("DISCORD_BOT_TOKEN", "env-token");
    const cfg = {
      channels: { discord: {} },
    } as OpenClawConfig;
    const res = resolveDiscordToken(cfg);
    expect(res.token).toBe("env-token");
    expect(res.source).toBe("env");
  });

  it("prefers account token for non-default accounts", () => {
    vi.stubEnv("DISCORD_BOT_TOKEN", "env-token");
    const cfg = {
      channels: {
        discord: {
          token: "base-token",
          accounts: {
            work: { token: "acct-token" },
          },
        },
      },
    } as OpenClawConfig;
    const res = resolveDiscordToken(cfg, { accountId: "work" });
    expect(res.token).toBe("acct-token");
    expect(res.source).toBe("config");
  });

  it("falls back to top-level token for non-default accounts without account token", () => {
    const cfg = {
      channels: {
        discord: {
          token: "base-token",
          accounts: {
            work: {},
          },
        },
      },
    } as OpenClawConfig;
    const res = resolveDiscordToken(cfg, { accountId: "work" });
    expect(res.token).toBe("base-token");
    expect(res.source).toBe("config");
  });

  it("does not inherit top-level token when account token is explicitly blank", () => {
    const cfg = {
      channels: {
        discord: {
          token: "base-token",
          accounts: {
            work: { token: "" },
          },
        },
      },
    } as OpenClawConfig;
    const res = resolveDiscordToken(cfg, { accountId: "work" });
    expect(res.token).toBe("");
    expect(res.source).toBe("none");
  });

  it("resolves account token when account key casing differs from normalized id", () => {
    const cfg = {
      channels: {
        discord: {
          accounts: {
            Work: { token: "acct-token" },
          },
        },
      },
    } as OpenClawConfig;
    const res = resolveDiscordToken(cfg, { accountId: "work" });
    expect(res.token).toBe("acct-token");
    expect(res.source).toBe("config");
  });

  it("throws when token is an unresolved SecretRef object", () => {
    const cfg = {
      channels: {
        discord: {
          token: { source: "env", provider: "default", id: "DISCORD_BOT_TOKEN" },
        },
      },
    } as unknown as OpenClawConfig;

    expect(() => resolveDiscordToken(cfg)).toThrow(
      /channels\.discord\.token: unresolved SecretRef/i,
    );
  });
});

describe("isDiscordTokenConfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true when channels.discord.token is set", () => {
    const cfg = {
      channels: { discord: { token: "bot-token" } },
    } as OpenClawConfig;
    expect(isDiscordTokenConfigured(cfg)).toBe(true);
  });

  it("returns true when DISCORD_BOT_TOKEN env is set", () => {
    vi.stubEnv("DISCORD_BOT_TOKEN", "env-token");
    const cfg = { channels: { discord: {} } } as OpenClawConfig;
    expect(isDiscordTokenConfigured(cfg)).toBe(true);
  });

  it("returns true when an account token is configured", () => {
    const cfg = {
      channels: {
        discord: {
          accounts: { work: { token: "account-token" } },
        },
      },
    } as unknown as OpenClawConfig;
    expect(isDiscordTokenConfigured(cfg)).toBe(true);
  });

  it("returns false when no token source is available", () => {
    const cfg = { channels: { discord: {} } } as OpenClawConfig;
    expect(isDiscordTokenConfigured(cfg)).toBe(false);
  });

  it("returns false when config is undefined", () => {
    expect(isDiscordTokenConfigured(undefined)).toBe(false);
  });
});
