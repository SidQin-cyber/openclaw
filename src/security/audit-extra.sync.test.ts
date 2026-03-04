import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { collectAttackSurfaceSummaryFindings, hasWebSearchKey } from "./audit-extra.sync.js";
import { safeEqualSecret } from "./secret-equal.js";

describe("collectAttackSurfaceSummaryFindings", () => {
  it("distinguishes external webhooks from internal hooks when only internal hooks are enabled", () => {
    const cfg: OpenClawConfig = {
      hooks: { internal: { enabled: true } },
    };

    const [finding] = collectAttackSurfaceSummaryFindings(cfg);
    expect(finding.checkId).toBe("summary.attack_surface");
    expect(finding.detail).toContain("hooks.webhooks: disabled");
    expect(finding.detail).toContain("hooks.internal: enabled");
  });

  it("reports both hook systems as enabled when both are configured", () => {
    const cfg: OpenClawConfig = {
      hooks: { enabled: true, internal: { enabled: true } },
    };

    const [finding] = collectAttackSurfaceSummaryFindings(cfg);
    expect(finding.detail).toContain("hooks.webhooks: enabled");
    expect(finding.detail).toContain("hooks.internal: enabled");
  });

  it("reports both hook systems as disabled when neither is configured", () => {
    const cfg: OpenClawConfig = {};

    const [finding] = collectAttackSurfaceSummaryFindings(cfg);
    expect(finding.detail).toContain("hooks.webhooks: disabled");
    expect(finding.detail).toContain("hooks.internal: disabled");
  });
});

describe("hasWebSearchKey", () => {
  const emptyEnv = {} as NodeJS.ProcessEnv;

  it("detects Brave key from config", () => {
    const cfg = { tools: { web: { search: { apiKey: "brave-key" } } } } as any;
    expect(hasWebSearchKey(cfg, emptyEnv)).toBe(true);
  });

  it("detects Gemini key from config", () => {
    const cfg = { tools: { web: { search: { gemini: { apiKey: "gem-key" } } } } } as any;
    expect(hasWebSearchKey(cfg, emptyEnv)).toBe(true);
  });

  it("detects Grok key from env", () => {
    expect(hasWebSearchKey({}, { XAI_API_KEY: "xai-key" } as any)).toBe(true);
  });

  it("detects Kimi key from env", () => {
    expect(hasWebSearchKey({}, { KIMI_API_KEY: "kimi-key" } as any)).toBe(true);
    expect(hasWebSearchKey({}, { MOONSHOT_API_KEY: "moon-key" } as any)).toBe(true);
  });

  it("detects Gemini key from env", () => {
    expect(hasWebSearchKey({}, { GEMINI_API_KEY: "gemini-key" } as any)).toBe(true);
  });

  it("returns false when no keys configured", () => {
    expect(hasWebSearchKey({}, emptyEnv)).toBe(false);
  });
});

describe("safeEqualSecret", () => {
  it("matches identical secrets", () => {
    expect(safeEqualSecret("secret-token", "secret-token")).toBe(true);
  });

  it("rejects mismatched secrets", () => {
    expect(safeEqualSecret("secret-token", "secret-tokEn")).toBe(false);
  });

  it("rejects different-length secrets", () => {
    expect(safeEqualSecret("short", "much-longer")).toBe(false);
  });

  it("rejects missing values", () => {
    expect(safeEqualSecret(undefined, "secret")).toBe(false);
    expect(safeEqualSecret("secret", undefined)).toBe(false);
    expect(safeEqualSecret(null, "secret")).toBe(false);
  });
});
