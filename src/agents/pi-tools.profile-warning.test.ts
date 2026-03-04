import { describe, it, expect, vi, beforeEach } from "vitest";
import { __test__ } from "./pi-tools.js";

const { warnConfiguredToolsHiddenByProfile } = __test__;

vi.mock("../logger.js", () => ({
  logWarn: vi.fn(),
  logDebug: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

import { logWarn } from "../logger.js";

function fakeTool(name: string) {
  return { name, description: "", parameters: {} } as never;
}

describe("warnConfiguredToolsHiddenByProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("warns when exec is configured but hidden by messaging profile", () => {
    warnConfiguredToolsHiddenByProfile({
      profile: "messaging",
      before: [fakeTool("exec"), fakeTool("sessions_list"), fakeTool("session_status")],
      after: [fakeTool("sessions_list"), fakeTool("session_status")],
      cfg: { tools: { exec: { security: "full" } } } as never,
    });
    expect(logWarn).toHaveBeenCalledOnce();
    expect(vi.mocked(logWarn).mock.calls[0]?.[0]).toMatch(/tools\.profile "messaging" hides.*exec/);
  });

  it("does not warn when profile is full", () => {
    warnConfiguredToolsHiddenByProfile({
      profile: "full",
      before: [fakeTool("exec")],
      after: [],
      cfg: { tools: { exec: { security: "full" } } } as never,
    });
    expect(logWarn).not.toHaveBeenCalled();
  });

  it("does not warn when no configured tools are hidden", () => {
    warnConfiguredToolsHiddenByProfile({
      profile: "messaging",
      before: [fakeTool("sessions_list")],
      after: [fakeTool("sessions_list")],
      cfg: { tools: { exec: { security: "full" } } } as never,
    });
    expect(logWarn).not.toHaveBeenCalled();
  });

  it("does not warn when hidden tools have no explicit config", () => {
    warnConfiguredToolsHiddenByProfile({
      profile: "messaging",
      before: [fakeTool("exec"), fakeTool("sessions_list")],
      after: [fakeTool("sessions_list")],
      cfg: {} as never,
    });
    expect(logWarn).not.toHaveBeenCalled();
  });

  it("warns when fs tools are configured but hidden by minimal profile", () => {
    warnConfiguredToolsHiddenByProfile({
      profile: "minimal",
      before: [fakeTool("read"), fakeTool("write"), fakeTool("session_status")],
      after: [fakeTool("session_status")],
      cfg: { tools: { fs: { workspaceOnly: true } } } as never,
    });
    expect(logWarn).toHaveBeenCalledOnce();
    expect(vi.mocked(logWarn).mock.calls[0]?.[0]).toMatch(/read, write/);
  });

  it("suggests tools.alsoAllow in the warning message", () => {
    warnConfiguredToolsHiddenByProfile({
      profile: "messaging",
      before: [fakeTool("exec"), fakeTool("sessions_list")],
      after: [fakeTool("sessions_list")],
      cfg: { tools: { exec: { security: "full" } } } as never,
    });
    expect(vi.mocked(logWarn).mock.calls[0]?.[0]).toMatch(/tools\.alsoAllow/);
  });

  it("does not warn when profile is unset", () => {
    warnConfiguredToolsHiddenByProfile({
      profile: undefined,
      before: [fakeTool("exec")],
      after: [],
      cfg: { tools: { exec: { security: "full" } } } as never,
    });
    expect(logWarn).not.toHaveBeenCalled();
  });
});
