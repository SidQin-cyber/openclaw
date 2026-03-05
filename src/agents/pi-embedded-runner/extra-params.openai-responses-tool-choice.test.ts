import type { StreamFn } from "@mariozechner/pi-agent-core";
import type { Context, Model, SimpleStreamOptions } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";
import { applyExtraParamsToAgent } from "./extra-params.js";

vi.mock("@mariozechner/pi-ai", () => ({
  streamSimple: vi.fn(() => ({
    push: vi.fn(),
    result: vi.fn(),
  })),
}));

type ToolChoiceCase = {
  applyProvider: string;
  applyModelId: string;
  model: Model<"openai-responses">;
  payload?: Record<string, unknown>;
  cfg?: Parameters<typeof applyExtraParamsToAgent>[1];
  options?: SimpleStreamOptions;
};

function runToolChoiceCase(params: ToolChoiceCase) {
  const payload: Record<string, unknown> = {
    model: params.model.id,
    input: [],
    ...params.payload,
  };
  const baseStreamFn: StreamFn = (_model, _context, options) => {
    options?.onPayload?.(payload);
    return {} as ReturnType<StreamFn>;
  };
  const agent = { streamFn: baseStreamFn };

  applyExtraParamsToAgent(agent, params.cfg, params.applyProvider, params.applyModelId);

  const context: Context = { messages: [] };
  void agent.streamFn?.(params.model, context, params.options ?? {});

  return payload;
}

const customResponsesModel = {
  api: "openai-responses",
  provider: "sub2api-gpt",
  id: "gpt-5.3-codex",
} as Model<"openai-responses">;

const openaiResponsesModel = {
  api: "openai-responses",
  provider: "openai",
  id: "gpt-5",
} as Model<"openai-responses">;

const openaiCompletionsModel = {
  api: "openai-completions",
  provider: "openai",
  id: "gpt-5",
} as Model<"openai-completions">;

describe("extra-params: openai-responses tool_choice default (#36057)", () => {
  it("injects tool_choice='auto' when tools present but tool_choice null (custom provider)", () => {
    const payload = runToolChoiceCase({
      applyProvider: "sub2api-gpt",
      applyModelId: "gpt-5.3-codex",
      model: customResponsesModel,
      payload: {
        tools: [{ type: "function", name: "exec" }],
        tool_choice: null,
      },
    });

    expect(payload.tool_choice).toBe("auto");
  });

  it("injects tool_choice='auto' when tools present and tool_choice undefined", () => {
    const payload = runToolChoiceCase({
      applyProvider: "sub2api-gpt",
      applyModelId: "gpt-5.3-codex",
      model: customResponsesModel,
      payload: {
        tools: [{ type: "function", name: "exec" }],
      },
    });

    expect(payload.tool_choice).toBe("auto");
  });

  it("preserves explicit tool_choice='required'", () => {
    const payload = runToolChoiceCase({
      applyProvider: "sub2api-gpt",
      applyModelId: "gpt-5.3-codex",
      model: customResponsesModel,
      payload: {
        tools: [{ type: "function", name: "exec" }],
        tool_choice: "required",
      },
    });

    expect(payload.tool_choice).toBe("required");
  });

  it("preserves explicit tool_choice='none'", () => {
    const payload = runToolChoiceCase({
      applyProvider: "sub2api-gpt",
      applyModelId: "gpt-5.3-codex",
      model: customResponsesModel,
      payload: {
        tools: [{ type: "function", name: "exec" }],
        tool_choice: "none",
      },
    });

    expect(payload.tool_choice).toBe("none");
  });

  it("does not inject tool_choice when tools array is empty", () => {
    const payload = runToolChoiceCase({
      applyProvider: "sub2api-gpt",
      applyModelId: "gpt-5.3-codex",
      model: customResponsesModel,
      payload: {
        tools: [],
      },
    });

    expect(payload.tool_choice).toBeUndefined();
  });

  it("does not inject tool_choice when no tools field", () => {
    const payload = runToolChoiceCase({
      applyProvider: "sub2api-gpt",
      applyModelId: "gpt-5.3-codex",
      model: customResponsesModel,
      payload: {},
    });

    expect(payload.tool_choice).toBeUndefined();
  });

  it("injects tool_choice for direct openai provider too", () => {
    const payload = runToolChoiceCase({
      applyProvider: "openai",
      applyModelId: "gpt-5",
      model: openaiResponsesModel,
      payload: {
        tools: [{ type: "function", name: "exec" }],
        tool_choice: null,
      },
    });

    expect(payload.tool_choice).toBe("auto");
  });

  it("does not inject tool_choice for non-responses API", () => {
    const payload = runToolChoiceCase({
      applyProvider: "openai",
      applyModelId: "gpt-5",
      model: openaiCompletionsModel as unknown as Model<"openai-responses">,
      payload: {
        tools: [{ type: "function", name: "exec" }],
        tool_choice: null,
      },
    });

    expect(payload.tool_choice).toBeNull();
  });
});
