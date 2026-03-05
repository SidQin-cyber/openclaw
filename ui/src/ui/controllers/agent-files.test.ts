import { describe, expect, it, vi } from "vitest";
import type { AgentFilesState } from "./agent-files.ts";
import { loadAgentFiles, loadAgentFileContent } from "./agent-files.ts";

function mockClient(responses: Record<string, unknown>) {
  return {
    request: vi.fn(async (method: string) => responses[method] ?? null),
  };
}

function buildState(overrides?: Partial<AgentFilesState>): AgentFilesState {
  return {
    client: null,
    connected: true,
    agentFilesLoading: false,
    agentFilesError: null,
    agentFilesList: null,
    agentFileContents: {},
    agentFileDrafts: {},
    agentFileActive: null,
    agentFileSaving: false,
    ...overrides,
  };
}

describe("loadAgentFiles", () => {
  it("loads the file list metadata", async () => {
    const client = mockClient({
      "agents.files.list": {
        agentId: "main",
        files: [{ name: "MEMORY.md", size: 100 }],
      },
    });
    const state = buildState({ client: client as unknown as AgentFilesState["client"] });

    await loadAgentFiles(state, "main");

    expect(client.request).toHaveBeenCalledWith("agents.files.list", { agentId: "main" });
    expect(state.agentFilesList?.files).toHaveLength(1);
  });

  it("does not fetch file contents", async () => {
    const client = mockClient({
      "agents.files.list": {
        agentId: "main",
        files: [{ name: "MEMORY.md", size: 100 }],
      },
    });
    const state = buildState({
      client: client as unknown as AgentFilesState["client"],
      agentFileActive: "MEMORY.md",
      agentFileContents: { "MEMORY.md": "old content" },
      agentFileDrafts: { "MEMORY.md": "old content" },
    });

    await loadAgentFiles(state, "main");

    expect(client.request).toHaveBeenCalledTimes(1);
    expect(state.agentFileContents["MEMORY.md"]).toBe("old content");
  });
});

describe("loadAgentFileContent", () => {
  it("skips fetch when content is cached and force is not set", async () => {
    const client = mockClient({});
    const state = buildState({
      client: client as unknown as AgentFilesState["client"],
      agentFileContents: { "MEMORY.md": "cached" },
    });

    await loadAgentFileContent(state, "main", "MEMORY.md");

    expect(client.request).not.toHaveBeenCalled();
  });

  it("re-fetches when force is true", async () => {
    const client = mockClient({
      "agents.files.get": {
        file: { name: "MEMORY.md", content: "updated content", size: 200 },
      },
    });
    const state = buildState({
      client: client as unknown as AgentFilesState["client"],
      agentFileContents: { "MEMORY.md": "old content" },
      agentFileDrafts: { "MEMORY.md": "old content" },
    });

    await loadAgentFileContent(state, "main", "MEMORY.md", {
      force: true,
      preserveDraft: false,
    });

    expect(client.request).toHaveBeenCalledWith("agents.files.get", {
      agentId: "main",
      name: "MEMORY.md",
    });
    expect(state.agentFileContents["MEMORY.md"]).toBe("updated content");
    expect(state.agentFileDrafts["MEMORY.md"]).toBe("updated content");
  });

  it("preserves draft when preserveDraft is true and draft differs from base", async () => {
    const client = mockClient({
      "agents.files.get": {
        file: { name: "MEMORY.md", content: "disk content", size: 200 },
      },
    });
    const state = buildState({
      client: client as unknown as AgentFilesState["client"],
      agentFileContents: { "MEMORY.md": "old base" },
      agentFileDrafts: { "MEMORY.md": "user edits in progress" },
    });

    await loadAgentFileContent(state, "main", "MEMORY.md", {
      force: true,
      preserveDraft: true,
    });

    expect(state.agentFileContents["MEMORY.md"]).toBe("disk content");
    expect(state.agentFileDrafts["MEMORY.md"]).toBe("user edits in progress");
  });
});
