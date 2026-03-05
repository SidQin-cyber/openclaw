import { describe, expect, it } from "vitest";
import { ModelProviderSchema } from "./zod-schema.core.js";

describe("ModelProviderSchema: partial overrides (#34788)", () => {
  it("accepts a headers-only provider override", () => {
    const result = ModelProviderSchema.safeParse({
      headers: { "cf-aig-authorization": "Bearer abc123" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a full provider with baseUrl, models, and headers", () => {
    const result = ModelProviderSchema.safeParse({
      baseUrl: "https://gateway.ai.cloudflare.com/v1/abc",
      models: [{ id: "claude-sonnet-4-6", name: "sonnet" }],
      headers: { "cf-aig-authorization": "Bearer abc123" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts apiKey-only override", () => {
    const result = ModelProviderSchema.safeParse({
      apiKey: "sk-test",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown fields due to .strict()", () => {
    const result = ModelProviderSchema.safeParse({
      headers: { "cf-aig-authorization": "Bearer abc123" },
      unknownField: true,
    });
    expect(result.success).toBe(false);
  });
});
