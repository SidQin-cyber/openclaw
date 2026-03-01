import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { normalizeAllowFrom } from "./bot-access.js";
import {
  evaluateTelegramGroupPolicyAccess,
  resolveTelegramRuntimeGroupPolicy,
} from "./group-access.js";

describe("resolveTelegramRuntimeGroupPolicy", () => {
  it("fails closed when channels.telegram is missing and no defaults are set", () => {
    const resolved = resolveTelegramRuntimeGroupPolicy({
      providerConfigPresent: false,
    });
    expect(resolved.groupPolicy).toBe("allowlist");
    expect(resolved.providerMissingFallbackApplied).toBe(true);
  });

  it("keeps open fallback when channels.telegram is configured", () => {
    const resolved = resolveTelegramRuntimeGroupPolicy({
      providerConfigPresent: true,
    });
    expect(resolved.groupPolicy).toBe("open");
    expect(resolved.providerMissingFallbackApplied).toBe(false);
  });

  it("ignores explicit defaults when provider config is missing", () => {
    const resolved = resolveTelegramRuntimeGroupPolicy({
      providerConfigPresent: false,
      defaultGroupPolicy: "disabled",
    });
    expect(resolved.groupPolicy).toBe("allowlist");
    expect(resolved.providerMissingFallbackApplied).toBe(true);
  });
});

describe("evaluateTelegramGroupPolicyAccess", () => {
  const baseParams = {
    isGroup: true,
    chatId: "group-1",
    cfg: {} as OpenClawConfig,
    telegramCfg: {},
    effectiveGroupAllow: normalizeAllowFrom([]),
    senderId: "123",
    senderUsername: "user",
    resolveGroupPolicy: () => ({ allowlistEnabled: false, allowed: true }),
    enforcePolicy: true,
    useTopicAndGroupOverrides: true,
    enforceAllowlistAuthorization: true,
    allowEmptyAllowlistEntries: false,
    requireSenderForAllowlistAuthorization: true,
    checkChatAllowlist: false,
  } as const;

  it("fails closed when provider config is not marked present", () => {
    const result = evaluateTelegramGroupPolicyAccess(baseParams);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe("group-policy-allowlist-empty");
      expect(result.groupPolicy).toBe("allowlist");
    }
  });

  it("keeps groups open when provider config is marked present", () => {
    const result = evaluateTelegramGroupPolicyAccess({
      ...baseParams,
      providerConfigPresent: true,
    });
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.groupPolicy).toBe("open");
    }
  });
});
