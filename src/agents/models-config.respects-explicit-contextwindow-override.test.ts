import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import type { ModelDefinitionConfig } from "../config/types.models.js";
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

const PROVIDER_KEY = "custom-proxy";
const MODEL_ID = "qwen3:4b";
const TEST_KEY = "sk-test";

const baseProvider = {
  baseUrl: "http://localhost:11434/v1",
  apiKey: TEST_KEY,
  api: "openai-completions",
} as const;

const baseModel: ModelDefinitionConfig = {
  id: MODEL_ID,
  name: "Qwen3 4B",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 8192,
};

function makeConfig(overrides: {
  contextWindow: number;
  maxTokens: number;
}): OpenClawConfig {
  return {
    models: {
      providers: {
        [PROVIDER_KEY]: {
          ...baseProvider,
          models: [
            {
              ...baseModel,
              contextWindow: overrides.contextWindow,
              maxTokens: overrides.maxTokens,
            },
          ],
        },
      },
    },
  };
}

async function readModel(): Promise<ModelEntry | undefined> {
  const parsed = await readGeneratedModelsJson<ModelsJson>();
  return parsed.providers[PROVIDER_KEY]?.models?.find((m) => m.id === MODEL_ID);
}

describe("models-config: explicit contextWindow / maxTokens override (#35436)", () => {
  it("honours user contextWindow when it is lower than the implicit catalog value", async () => {
    await withTempHome(async () => {
      const cfg = makeConfig({ contextWindow: 4096, maxTokens: 2048 });
      await ensureOpenClawModelsJson(cfg);
      const m = await readModel();
      expect(m).toBeDefined();
      expect(m?.contextWindow).toBe(4096);
      expect(m?.maxTokens).toBe(2048);
    });
  });

  it("honours user contextWindow when it is higher than the implicit value", async () => {
    await withTempHome(async () => {
      const cfg = makeConfig({ contextWindow: 256000, maxTokens: 32000 });
      await ensureOpenClawModelsJson(cfg);
      const m = await readModel();
      expect(m).toBeDefined();
      expect(m?.contextWindow).toBe(256000);
      expect(m?.maxTokens).toBe(32000);
    });
  });

  it("preserves explicit contextWindow even when equal to implicit", async () => {
    await withTempHome(async () => {
      const cfg = makeConfig({ contextWindow: 128000, maxTokens: 8192 });
      await ensureOpenClawModelsJson(cfg);
      const m = await readModel();
      expect(m).toBeDefined();
      expect(m?.contextWindow).toBe(128000);
      expect(m?.maxTokens).toBe(8192);
    });
  });
});
