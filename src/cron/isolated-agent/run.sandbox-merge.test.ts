import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearFastTestEnv,
  loadRunCronIsolatedAgentTurn,
  makeCronSession,
  makeCronSessionEntry,
  resolveAgentConfigMock,
  resolveAllowedModelRefMock,
  resolveConfiguredModelRefMock,
  resolveCronSessionMock,
  resetRunCronIsolatedAgentTurnHarness,
  restoreFastTestEnv,
  runWithModelFallbackMock,
  updateSessionStoreMock,
} from "./run.test-harness.js";

const runCronIsolatedAgentTurn = await loadRunCronIsolatedAgentTurn();

function makeJob(overrides?: Record<string, unknown>) {
  return {
    id: "sandbox-test",
    name: "Sandbox Test",
    schedule: { kind: "cron", expr: "0 9 * * *", tz: "UTC" },
    sessionTarget: "isolated",
    payload: { kind: "agentTurn", message: "test" },
    ...overrides,
  } as never;
}

function makeParams(overrides?: Record<string, unknown>) {
  return {
    cfg: {},
    deps: {} as never,
    job: makeJob(),
    message: "test",
    sessionKey: "cron:sandbox-test",
    ...overrides,
  };
}

describe("runCronIsolatedAgentTurn — sandbox config merge (#38067)", () => {
  let previousFastTestEnv: string | undefined;

  beforeEach(() => {
    previousFastTestEnv = process.env.FAST_TEST;
    process.env.FAST_TEST = "1";
    resetRunCronIsolatedAgentTurnHarness();

    resolveCronSessionMock.mockReturnValue(
      makeCronSession({ sessionEntry: makeCronSessionEntry() }),
    );
    resolveConfiguredModelRefMock.mockReturnValue({ provider: "openai", model: "gpt-4" });
    resolveAllowedModelRefMock.mockReturnValue({
      ref: { provider: "openai", model: "gpt-4" },
    });
    updateSessionStoreMock.mockResolvedValue(undefined);
    runWithModelFallbackMock.mockResolvedValue({
      result: {
        payloads: [{ text: "ok" }],
        meta: { agentMeta: { usage: { input: 10, output: 20 } } },
      },
      provider: "openai",
      model: "gpt-4",
      attempts: [],
    });
  });

  afterEach(() => {
    if (previousFastTestEnv !== undefined) {
      restoreFastTestEnv(previousFastTestEnv);
    } else {
      clearFastTestEnv();
    }
  });

  it("does not shallow-merge agent sandbox into defaults, preserving dangerouslyAllow flags", async () => {
    const cfg = {
      agents: {
        defaults: {
          sandbox: {
            mode: "docker",
            docker: {
              dangerouslyAllowExternalBindSources: true,
              network: "host",
            },
          },
        },
      },
    };

    resolveAgentConfigMock.mockReturnValue({
      sandbox: {
        docker: {
          binds: ["/data/shared:/mnt/shared:ro"],
        },
      },
    });

    await runCronIsolatedAgentTurn(makeParams({ cfg, agentId: "kotik" }));

    const callArgs = runWithModelFallbackMock.mock.calls[0];
    const passedCfg = callArgs?.[0]?.cfg;
    const defaultsSandbox = passedCfg?.agents?.defaults?.sandbox;

    expect(defaultsSandbox?.docker?.dangerouslyAllowExternalBindSources).toBe(true);
    expect(defaultsSandbox?.docker?.network).toBe("host");
    expect(defaultsSandbox?.docker?.binds).toBeUndefined();
  });
});
