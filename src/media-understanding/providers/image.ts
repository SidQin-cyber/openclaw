import type { Api, Context, Model } from "@mariozechner/pi-ai";
import { complete } from "@mariozechner/pi-ai";
import { minimaxUnderstandImage } from "../../agents/minimax-vlm.js";
import { getApiKeyForModel, requireApiKey } from "../../agents/model-auth.js";
import { normalizeModelCompat } from "../../agents/model-compat.js";
import { normalizeProviderId } from "../../agents/model-selection.js";
import { ensureOpenClawModelsJson } from "../../agents/models-config.js";
import { buildInlineProviderModels } from "../../agents/pi-embedded-runner/model.js";
import { discoverAuthStorage, discoverModels } from "../../agents/pi-model-discovery.js";
import { coerceImageAssistantText } from "../../agents/tools/image-tool.helpers.js";
import type { ImageDescriptionRequest, ImageDescriptionResult } from "../types.js";

export async function describeImageWithModel(
  params: ImageDescriptionRequest,
): Promise<ImageDescriptionResult> {
  await ensureOpenClawModelsJson(params.cfg, params.agentDir);
  const authStorage = discoverAuthStorage(params.agentDir);
  const modelRegistry = discoverModels(authStorage, params.agentDir);
  let model = modelRegistry.find(params.provider, params.model) as Model<Api> | null;
  if (!model) {
    const providers = params.cfg?.models?.providers ?? {};
    const inlineModels = buildInlineProviderModels(providers);
    const np = normalizeProviderId(params.provider);
    const inlineMatch = inlineModels.find(
      (e) => normalizeProviderId(e.provider) === np && e.id === params.model,
    );
    if (inlineMatch) {
      model = normalizeModelCompat(inlineMatch as Model<Api>);
    }
  }
  if (!model) {
    throw new Error(`Unknown model: ${params.provider}/${params.model}`);
  }
  if (!model.input?.includes("image")) {
    throw new Error(`Model does not support images: ${params.provider}/${params.model}`);
  }
  const apiKeyInfo = await getApiKeyForModel({
    model,
    cfg: params.cfg,
    agentDir: params.agentDir,
    profileId: params.profile,
    preferredProfile: params.preferredProfile,
  });
  const apiKey = requireApiKey(apiKeyInfo, model.provider);
  authStorage.setRuntimeApiKey(model.provider, apiKey);

  const base64 = params.buffer.toString("base64");
  if (model.provider === "minimax") {
    const text = await minimaxUnderstandImage({
      apiKey,
      prompt: params.prompt ?? "Describe the image.",
      imageDataUrl: `data:${params.mime ?? "image/jpeg"};base64,${base64}`,
      modelBaseUrl: model.baseUrl,
    });
    return { text, model: model.id };
  }

  const context: Context = {
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: params.prompt ?? "Describe the image." },
          { type: "image", data: base64, mimeType: params.mime ?? "image/jpeg" },
        ],
        timestamp: Date.now(),
      },
    ],
  };
  const message = await complete(model, context, {
    apiKey,
    maxTokens: params.maxTokens ?? 512,
  });
  const text = coerceImageAssistantText({
    message,
    provider: model.provider,
    model: model.id,
  });
  return { text, model: model.id };
}
