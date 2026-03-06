import { beforeEach, describe, expect, it } from "vitest";
import "./test-helpers/fast-core-tools.js";
import * as sessionsHarness from "./openclaw-tools.subagents.sessions-spawn.test-harness.js";
import { resetSubagentRegistryForTests } from "./subagent-registry.js";

const MAIN_SESSION_KEY = "agent:test:main";

function applySubagentTimeoutDefault(seconds: number, minSeconds?: number) {
  sessionsHarness.setSessionsSpawnConfigOverride({
    session: { mainKey: "main", scope: "per-sender" },
    agents: {
      defaults: {
        subagents: {
          runTimeoutSeconds: seconds,
          ...(minSeconds != null ? { minRunTimeoutSeconds: minSeconds } : {}),
        },
      },
    },
  });
}

function getSubagentTimeout(
  calls: Array<{ method?: string; params?: unknown }>,
): number | undefined {
  for (const call of calls) {
    if (call.method !== "agent") {
      continue;
    }
    const params = call.params as { lane?: string; timeout?: number } | undefined;
    if (params?.lane === "subagent") {
      return params.timeout;
    }
  }
  return undefined;
}

async function spawnSubagent(callId: string, payload: Record<string, unknown>) {
  const tool = await sessionsHarness.getSessionsSpawnTool({ agentSessionKey: MAIN_SESSION_KEY });
  const result = await tool.execute(callId, payload);
  expect(result.details).toMatchObject({ status: "accepted" });
}

describe("sessions_spawn default runTimeoutSeconds", () => {
  beforeEach(() => {
    sessionsHarness.resetSessionsSpawnConfigOverride();
    resetSubagentRegistryForTests();
    sessionsHarness.getCallGatewayMock().mockClear();
  });

  it("uses config default when agent omits runTimeoutSeconds", async () => {
    applySubagentTimeoutDefault(900);
    const gateway = sessionsHarness.setupSessionsSpawnGatewayMock({});

    await spawnSubagent("call-1", { task: "hello" });

    expect(getSubagentTimeout(gateway.calls)).toBe(900);
  });

  it("explicit runTimeoutSeconds wins over config default", async () => {
    applySubagentTimeoutDefault(900);
    const gateway = sessionsHarness.setupSessionsSpawnGatewayMock({});

    await spawnSubagent("call-2", { task: "hello", runTimeoutSeconds: 300 });

    expect(getSubagentTimeout(gateway.calls)).toBe(300);
  });

  it("enforces minRunTimeoutSeconds as floor when model sets lower value", async () => {
    applySubagentTimeoutDefault(300, 120);
    const gateway = sessionsHarness.setupSessionsSpawnGatewayMock({});

    await spawnSubagent("call-3", { task: "hello", runTimeoutSeconds: 60 });

    expect(getSubagentTimeout(gateway.calls)).toBe(120);
  });

  it("allows model timeout above minRunTimeoutSeconds", async () => {
    applySubagentTimeoutDefault(300, 120);
    const gateway = sessionsHarness.setupSessionsSpawnGatewayMock({});

    await spawnSubagent("call-4", { task: "hello", runTimeoutSeconds: 200 });

    expect(getSubagentTimeout(gateway.calls)).toBe(200);
  });
});
