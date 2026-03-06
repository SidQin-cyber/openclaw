import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import {
  installModelsConfigTestHooks,
  withModelsTempHome as withTempHome,
} from "./models-config.e2e-harness.js";
import { ensureOpenClawModelsJson } from "./models-config.js";
import { readGeneratedModelsJson } from "./models-config.test-utils.js";

installModelsConfigTestHooks();

type ModelEntry = {
  id: string;
  contextWindow?: number;
  maxTokens?: number;
};

type ModelsJson = {
  providers: Record<string, { models?: ModelEntry[] }>;
};

const MINIMAX_ENV_KEY = "MINIMAX_API_KEY";
const MINIMAX_MODEL_ID = "MiniMax-M2.5";
const MINIMAX_TEST_KEY = "sk-minimax-test";

const baseMinimaxProvider = {
  baseUrl: "https://api.minimax.io/anthropic",
  api: "anthropic-messages",
} as const;

async function withMinimaxApiKey(run: () => Promise<void>) {
  const prev = process.env[MINIMAX_ENV_KEY];
  process.env[MINIMAX_ENV_KEY] = MINIMAX_TEST_KEY;
  try {
    await run();
  } finally {
    if (prev === undefined) {
      delete process.env[MINIMAX_ENV_KEY];
    } else {
      process.env[MINIMAX_ENV_KEY] = prev;
    }
  }
}

async function generateAndReadMinimaxModel(cfg: OpenClawConfig): Promise<ModelEntry | undefined> {
  await ensureOpenClawModelsJson(cfg);
  const parsed = await readGeneratedModelsJson<ModelsJson>();
  return parsed.providers.minimax?.models?.find((model) => model.id === MINIMAX_MODEL_ID);
}

describe("models-config: explicit contextWindow override", () => {
  it("honours user contextWindow lower than built-in catalog value", async () => {
    await withTempHome(async () => {
      await withMinimaxApiKey(async () => {
        const cfg: OpenClawConfig = {
          models: {
            providers: {
              minimax: {
                ...baseMinimaxProvider,
                models: [
                  {
                    id: MINIMAX_MODEL_ID,
                    name: "MiniMax M2.5",
                    reasoning: false,
                    input: ["text"],
                    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                    contextWindow: 4096,
                    maxTokens: 2048,
                  },
                ],
              },
            },
          },
        };

        const model = await generateAndReadMinimaxModel(cfg);
        expect(model).toBeDefined();
        expect(model?.contextWindow).toBe(4096);
        expect(model?.maxTokens).toBe(2048);
      });
    });
  });

  it("falls back to built-in contextWindow when user omits the field", async () => {
    await withTempHome(async () => {
      await withMinimaxApiKey(async () => {
        const modelWithoutContextWindow = {
          id: MINIMAX_MODEL_ID,
          name: "MiniMax M2.5",
          reasoning: false,
          input: ["text"],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        };
        const cfg: OpenClawConfig = {
          models: {
            providers: {
              minimax: {
                ...baseMinimaxProvider,
                // @ts-expect-error Intentional: emulate user config omitting contextWindow/maxTokens.
                models: [modelWithoutContextWindow],
              },
            },
          },
        };

        const model = await generateAndReadMinimaxModel(cfg);
        expect(model).toBeDefined();
        // Built-in catalog value for MiniMax-M2.5 (200000) should be used.
        expect(model?.contextWindow).toBe(200000);
      });
    });
  });

  it("honours user contextWindow higher than built-in catalog value", async () => {
    await withTempHome(async () => {
      await withMinimaxApiKey(async () => {
        const cfg: OpenClawConfig = {
          models: {
            providers: {
              minimax: {
                ...baseMinimaxProvider,
                models: [
                  {
                    id: MINIMAX_MODEL_ID,
                    name: "MiniMax M2.5",
                    reasoning: false,
                    input: ["text"],
                    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                    contextWindow: 500000,
                    maxTokens: 16384,
                  },
                ],
              },
            },
          },
        };

        const model = await generateAndReadMinimaxModel(cfg);
        expect(model).toBeDefined();
        expect(model?.contextWindow).toBe(500000);
        expect(model?.maxTokens).toBe(16384);
      });
    });
  });
});
