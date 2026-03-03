import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import type { SessionEntry } from "../../config/sessions.js";
import { withStateDirEnv } from "../../test-helpers/state-dir-env.js";
import { resolveSessionAuthProfileOverride } from "./session-override.js";

async function writeAuthStore(agentDir: string, extra?: Record<string, unknown>) {
  const authPath = path.join(agentDir, "auth-profiles.json");
  const payload = {
    version: 1,
    profiles: {
      "zai:work": { type: "api_key", provider: "zai", key: "sk-test" },
    },
    order: {
      zai: ["zai:work"],
    },
    ...extra,
  };
  await fs.writeFile(authPath, JSON.stringify(payload), "utf-8");
}

async function writeMultiProfileStore(
  agentDir: string,
  opts?: { usageStats?: Record<string, { lastUsed?: number }> },
) {
  const authPath = path.join(agentDir, "auth-profiles.json");
  const payload = {
    version: 1,
    profiles: {
      "anthropic:default": { type: "api_key", provider: "anthropic", key: "sk-1" },
      "anthropic:secondary": { type: "api_key", provider: "anthropic", key: "sk-2" },
    },
    order: {
      anthropic: ["anthropic:default", "anthropic:secondary"],
    },
    ...(opts?.usageStats ? { usageStats: opts.usageStats } : {}),
  };
  await fs.writeFile(authPath, JSON.stringify(payload), "utf-8");
}

describe("resolveSessionAuthProfileOverride", () => {
  it("keeps user override when provider alias differs", async () => {
    await withStateDirEnv("openclaw-auth-", async ({ stateDir }) => {
      const agentDir = path.join(stateDir, "agent");
      await fs.mkdir(agentDir, { recursive: true });
      await writeAuthStore(agentDir);

      const sessionEntry: SessionEntry = {
        sessionId: "s1",
        updatedAt: Date.now(),
        authProfileOverride: "zai:work",
        authProfileOverrideSource: "user",
      };
      const sessionStore = { "agent:main:main": sessionEntry };

      const resolved = await resolveSessionAuthProfileOverride({
        cfg: {} as OpenClawConfig,
        provider: "z.ai",
        agentDir,
        sessionEntry,
        sessionStore,
        sessionKey: "agent:main:main",
        storePath: undefined,
        isNewSession: false,
      });

      expect(resolved).toBe("zai:work");
      expect(sessionEntry.authProfileOverride).toBe("zai:work");
    });
  });

  it("rotates to next profile on /new using store-level lastUsed (#32444)", async () => {
    await withStateDirEnv("openclaw-auth-rr-", async ({ stateDir }) => {
      const agentDir = path.join(stateDir, "agent");
      await fs.mkdir(agentDir, { recursive: true });
      await writeMultiProfileStore(agentDir, {
        usageStats: {
          "anthropic:default": { lastUsed: 1000 },
          "anthropic:secondary": { lastUsed: 500 },
        },
      });

      const sessionEntry: SessionEntry = {
        sessionId: "s-new",
        updatedAt: Date.now(),
      };
      const sessionStore = { "agent:main:dm": sessionEntry };

      const resolved = await resolveSessionAuthProfileOverride({
        cfg: {} as OpenClawConfig,
        provider: "anthropic",
        agentDir,
        sessionEntry,
        sessionStore,
        sessionKey: "agent:main:dm",
        storePath: undefined,
        isNewSession: true,
      });

      expect(resolved).toBe("anthropic:secondary");
    });
  });

  it("picks first available when no usageStats exist (#32444)", async () => {
    await withStateDirEnv("openclaw-auth-rr-nousage-", async ({ stateDir }) => {
      const agentDir = path.join(stateDir, "agent");
      await fs.mkdir(agentDir, { recursive: true });
      await writeMultiProfileStore(agentDir);

      const sessionEntry: SessionEntry = {
        sessionId: "s-new2",
        updatedAt: Date.now(),
      };
      const sessionStore = { "agent:main:dm": sessionEntry };

      const resolved = await resolveSessionAuthProfileOverride({
        cfg: {} as OpenClawConfig,
        provider: "anthropic",
        agentDir,
        sessionEntry,
        sessionStore,
        sessionKey: "agent:main:dm",
        storePath: undefined,
        isNewSession: true,
      });

      expect(resolved).toBe("anthropic:default");
    });
  });
});
