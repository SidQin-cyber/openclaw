import { describe, expect, it } from "vitest";
import { ensureAgentInConfigList } from "./agents-config-helpers.ts";

describe("ensureAgentInConfigList", () => {
  it("returns -1 when configValue is null", () => {
    expect(ensureAgentInConfigList(null, "my-agent")).toBe(-1);
  });

  it("creates agents.list when agents key does not exist", () => {
    const config: Record<string, unknown> = {};
    const index = ensureAgentInConfigList(config, "my-agent");
    expect(index).toBe(0);
    expect((config as { agents: { list: { id: string }[] } }).agents.list).toEqual([
      { id: "my-agent" },
    ]);
  });

  it("creates agents.list when list is not an array", () => {
    const config: Record<string, unknown> = { agents: { list: "invalid" } };
    const index = ensureAgentInConfigList(config, "my-agent");
    expect(index).toBe(0);
    expect((config as { agents: { list: { id: string }[] } }).agents.list).toEqual([
      { id: "my-agent" },
    ]);
  });

  it("returns existing index when agent is already in list", () => {
    const config: Record<string, unknown> = {
      agents: {
        list: [{ id: "agent-a" }, { id: "agent-b" }, { id: "agent-c" }],
      },
    };
    expect(ensureAgentInConfigList(config, "agent-b")).toBe(1);
    expect((config as { agents: { list: unknown[] } }).agents.list).toHaveLength(3);
  });

  it("appends agent to list when not found", () => {
    const config: Record<string, unknown> = {
      agents: {
        list: [{ id: "agent-a" }],
      },
    };
    const index = ensureAgentInConfigList(config, "new-agent");
    expect(index).toBe(1);
    expect((config as { agents: { list: unknown[] } }).agents.list).toHaveLength(2);
    expect((config as { agents: { list: { id: string }[] } }).agents.list[1]).toEqual({
      id: "new-agent",
    });
  });

  it("appends to empty list", () => {
    const config: Record<string, unknown> = {
      agents: { list: [] },
    };
    const index = ensureAgentInConfigList(config, "my-agent");
    expect(index).toBe(0);
    expect((config as { agents: { list: unknown[] } }).agents.list).toHaveLength(1);
  });
});
