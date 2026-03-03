import { beforeEach, describe, expect, it, vi } from "vitest";

const { callGateway } = vi.hoisted(() => ({
  callGateway: vi.fn(),
}));

vi.mock("../gateway/call.js", () => ({ callGateway }));
vi.mock("../infra/exec-obfuscation-detect.js", () => ({
  detectCommandObfuscation: () => ({ detected: false, reasons: [] }),
}));
vi.mock("../logger.js", () => ({ logInfo: vi.fn() }));

import { executeNodeHostCommand } from "./bash-tools.exec-host-node.js";

const NODE_ID = "node-1";

function createPreparePayload() {
  return {
    payload: {
      cmdText: "openclaw gateway restart",
      plan: {
        argv: ["/bin/sh", "-c", "openclaw gateway restart"],
        cwd: "/tmp",
        rawCommand: "openclaw gateway restart",
        agentId: null,
        sessionKey: null,
      },
    },
  };
}

beforeEach(() => {
  callGateway.mockClear();
});

describe("executeNodeHostCommand invoke timeout propagation", () => {
  it("uses computed invokeTimeoutMs for system.run.prepare instead of a hardcoded value", async () => {
    const capturedTimeouts: { command: string; timeoutMs: number }[] = [];

    callGateway.mockImplementation(async ({ method, params: gatewayParams, timeoutMs }) => {
      if (method === "node.list") {
        return {
          nodes: [{ nodeId: NODE_ID, commands: ["system.run"] }],
        };
      }
      if (method === "node.invoke") {
        const command = (gatewayParams as { command?: string } | undefined)?.command;
        capturedTimeouts.push({ command: command ?? "unknown", timeoutMs });
        if (command === "system.run.prepare") {
          return createPreparePayload();
        }
        return {
          payload: { stdout: "ok", stderr: "", exitCode: 0, success: true },
        };
      }
      throw new Error(`unexpected method: ${String(method)}`);
    });

    const defaultTimeoutSec = 1800;
    const expectedInvokeTimeoutMs = defaultTimeoutSec * 1000 + 5_000;

    await executeNodeHostCommand({
      command: "openclaw gateway restart",
      workdir: "/tmp",
      env: {},
      security: "full",
      ask: "off",
      defaultTimeoutSec,
      approvalRunningNoticeMs: 0,
      warnings: [],
    });

    expect(capturedTimeouts).toHaveLength(2);

    const prepareCall = capturedTimeouts.find((c) => c.command === "system.run.prepare");
    expect(prepareCall).toBeDefined();
    expect(prepareCall!.timeoutMs).toBe(expectedInvokeTimeoutMs);

    const runCall = capturedTimeouts.find((c) => c.command === "system.run");
    expect(runCall).toBeDefined();
    expect(runCall!.timeoutMs).toBe(expectedInvokeTimeoutMs);
  });

  it("respects explicit timeoutSec over defaultTimeoutSec for prepare call", async () => {
    const capturedTimeouts: { command: string; timeoutMs: number }[] = [];

    callGateway.mockImplementation(async ({ method, params: gatewayParams, timeoutMs }) => {
      if (method === "node.list") {
        return {
          nodes: [{ nodeId: NODE_ID, commands: ["system.run"] }],
        };
      }
      if (method === "node.invoke") {
        const command = (gatewayParams as { command?: string } | undefined)?.command;
        capturedTimeouts.push({ command: command ?? "unknown", timeoutMs });
        if (command === "system.run.prepare") {
          return createPreparePayload();
        }
        return {
          payload: { stdout: "ok", stderr: "", exitCode: 0, success: true },
        };
      }
      throw new Error(`unexpected method: ${String(method)}`);
    });

    const explicitTimeoutSec = 60;
    const expectedInvokeTimeoutMs = explicitTimeoutSec * 1000 + 5_000;

    await executeNodeHostCommand({
      command: "openclaw gateway restart",
      workdir: "/tmp",
      env: {},
      security: "full",
      ask: "off",
      timeoutSec: explicitTimeoutSec,
      defaultTimeoutSec: 1800,
      approvalRunningNoticeMs: 0,
      warnings: [],
    });

    const prepareCall = capturedTimeouts.find((c) => c.command === "system.run.prepare");
    expect(prepareCall).toBeDefined();
    expect(prepareCall!.timeoutMs).toBe(expectedInvokeTimeoutMs);
  });

  it("enforces minimum 10s for invokeTimeoutMs on prepare call", async () => {
    const capturedTimeouts: { command: string; timeoutMs: number }[] = [];

    callGateway.mockImplementation(async ({ method, params: gatewayParams, timeoutMs }) => {
      if (method === "node.list") {
        return {
          nodes: [{ nodeId: NODE_ID, commands: ["system.run"] }],
        };
      }
      if (method === "node.invoke") {
        const command = (gatewayParams as { command?: string } | undefined)?.command;
        capturedTimeouts.push({ command: command ?? "unknown", timeoutMs });
        if (command === "system.run.prepare") {
          return createPreparePayload();
        }
        return {
          payload: { stdout: "ok", stderr: "", exitCode: 0, success: true },
        };
      }
      throw new Error(`unexpected method: ${String(method)}`);
    });

    await executeNodeHostCommand({
      command: "echo hi",
      workdir: "/tmp",
      env: {},
      security: "full",
      ask: "off",
      timeoutSec: 1,
      defaultTimeoutSec: 1,
      approvalRunningNoticeMs: 0,
      warnings: [],
    });

    const prepareCall = capturedTimeouts.find((c) => c.command === "system.run.prepare");
    expect(prepareCall).toBeDefined();
    expect(prepareCall!.timeoutMs).toBe(10_000);
  });
});
