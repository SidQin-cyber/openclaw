import { describe, expect, it } from "vitest";
import { resolveSlackAccount, resolveSlackReplyToMode } from "./accounts.js";

describe("resolveSlackAccount allowFrom precedence", () => {
  it("prefers accounts.default.allowFrom over top-level for default account", () => {
    const resolved = resolveSlackAccount({
      cfg: {
        channels: {
          slack: {
            allowFrom: ["top"],
            accounts: {
              default: {
                botToken: "xoxb-default",
                appToken: "xapp-default",
                allowFrom: ["default"],
              },
            },
          },
        },
      },
      accountId: "default",
    });

    expect(resolved.config.allowFrom).toEqual(["default"]);
  });

  it("falls back to top-level allowFrom for named account without override", () => {
    const resolved = resolveSlackAccount({
      cfg: {
        channels: {
          slack: {
            allowFrom: ["top"],
            accounts: {
              work: { botToken: "xoxb-work", appToken: "xapp-work" },
            },
          },
        },
      },
      accountId: "work",
    });

    expect(resolved.config.allowFrom).toEqual(["top"]);
  });

  it("does not inherit default account allowFrom for named account when top-level is absent", () => {
    const resolved = resolveSlackAccount({
      cfg: {
        channels: {
          slack: {
            accounts: {
              default: {
                botToken: "xoxb-default",
                appToken: "xapp-default",
                allowFrom: ["default"],
              },
              work: { botToken: "xoxb-work", appToken: "xapp-work" },
            },
          },
        },
      },
      accountId: "work",
    });

    expect(resolved.config.allowFrom).toBeUndefined();
  });

  it("falls back to top-level dm.allowFrom when allowFrom alias is unset", () => {
    const resolved = resolveSlackAccount({
      cfg: {
        channels: {
          slack: {
            dm: { allowFrom: ["U123"] },
            accounts: {
              work: { botToken: "xoxb-work", appToken: "xapp-work" },
            },
          },
        },
      },
      accountId: "work",
    });

    expect(resolved.config.allowFrom).toBeUndefined();
    expect(resolved.config.dm?.allowFrom).toEqual(["U123"]);
  });
});

describe("resolveSlackReplyToMode per-channel override", () => {
  const account = {
    replyToMode: "off" as const,
    replyToModeByChatType: { channel: "first" as const },
  };

  it("uses channel-level replyToMode when provided", () => {
    expect(resolveSlackReplyToMode(account, "channel", "all")).toBe("all");
  });

  it("falls back to chatType-level when channel override is undefined", () => {
    expect(resolveSlackReplyToMode(account, "channel", undefined)).toBe("first");
  });

  it("falls back to account-level when no chatType or channel override", () => {
    expect(resolveSlackReplyToMode(account, null, undefined)).toBe("off");
  });

  it("channel override takes precedence over chatType override", () => {
    expect(resolveSlackReplyToMode(account, "channel", "off")).toBe("off");
  });
});
