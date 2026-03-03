import { describe, expect, it } from "vitest";
import { buildPayloads, expectSingleToolErrorPayload } from "./payloads.test-helpers.js";

describe("buildEmbeddedRunPayloads tool-error warnings", () => {
  it("suppresses exec tool errors when verbose mode is off", () => {
    const payloads = buildPayloads({
      lastToolError: { toolName: "exec", error: "command failed" },
      verboseLevel: "off",
    });

    expect(payloads).toHaveLength(0);
  });

  it("shows exec tool errors when verbose mode is on", () => {
    const payloads = buildPayloads({
      lastToolError: { toolName: "exec", error: "command failed" },
      verboseLevel: "on",
    });

    expectSingleToolErrorPayload(payloads, {
      title: "Exec",
      detail: "command failed",
    });
  });

  it("keeps non-exec mutating tool failures visible", () => {
    const payloads = buildPayloads({
      lastToolError: { toolName: "write", error: "permission denied" },
      verboseLevel: "off",
    });

    expectSingleToolErrorPayload(payloads, {
      title: "Write",
      absentDetail: "permission denied",
    });
  });

  it.each([
    {
      name: "includes details for mutating tool failures when verbose is on",
      verboseLevel: "on" as const,
      detail: "permission denied",
      absentDetail: undefined,
    },
    {
      name: "includes details for mutating tool failures when verbose is full",
      verboseLevel: "full" as const,
      detail: "permission denied",
      absentDetail: undefined,
    },
  ])("$name", ({ verboseLevel, detail, absentDetail }) => {
    const payloads = buildPayloads({
      lastToolError: { toolName: "write", error: "permission denied" },
      verboseLevel,
    });

    expectSingleToolErrorPayload(payloads, {
      title: "Write",
      detail,
      absentDetail,
    });
  });

  it("suppresses sessions_send errors to avoid leaking transient relay failures", () => {
    const payloads = buildPayloads({
      lastToolError: { toolName: "sessions_send", error: "delivery timeout" },
      verboseLevel: "on",
    });

    expect(payloads).toHaveLength(0);
  });

  it("suppresses sessions_send errors even when marked mutating", () => {
    const payloads = buildPayloads({
      lastToolError: {
        toolName: "sessions_send",
        error: "delivery timeout",
        mutatingAction: true,
      },
      verboseLevel: "on",
    });

    expect(payloads).toHaveLength(0);
  });
});

describe("buildEmbeddedRunPayloads tool media extraction", () => {
  it("includes tool media in payloads even when inlineToolResultsAllowed is false", () => {
    const payloads = buildPayloads({
      inlineToolResultsAllowed: false,
      toolMetas: [
        {
          toolName: "tts",
          meta: "voice note\nMEDIA:https://cdn.example.com/voice.ogg\n[[audio_as_voice]]",
        },
      ],
    });

    expect(payloads.length).toBeGreaterThanOrEqual(1);
    const mediaPayload = payloads.find((p) => p.mediaUrls && p.mediaUrls.length > 0);
    expect(mediaPayload).toBeDefined();
    expect(mediaPayload!.mediaUrls).toContain("https://cdn.example.com/voice.ogg");
    expect(mediaPayload!.audioAsVoice).toBe(true);
  });

  it("does not duplicate media when inlineToolResultsAllowed is true", () => {
    const payloads = buildPayloads({
      inlineToolResultsAllowed: true,
      verboseLevel: "on",
      toolMetas: [
        {
          toolName: "tts",
          meta: "voice note\nMEDIA:https://cdn.example.com/voice.ogg",
        },
      ],
    });

    const mediaPayloads = payloads.filter((p) => p.mediaUrls && p.mediaUrls.length > 0);
    expect(mediaPayloads).toHaveLength(1);
  });

  it("does not extract media on non-cron path when verboseLevel is off", () => {
    const payloads = buildPayloads({
      inlineToolResultsAllowed: true,
      verboseLevel: "off",
      toolMetas: [
        {
          toolName: "tts",
          meta: "voice note\nMEDIA:https://cdn.example.com/voice.ogg",
        },
      ],
    });

    const mediaPayloads = payloads.filter((p) => p.mediaUrls && p.mediaUrls.length > 0);
    expect(mediaPayloads).toHaveLength(0);
  });

  it("skips tool metas without media when inlineToolResultsAllowed is false", () => {
    const payloads = buildPayloads({
      inlineToolResultsAllowed: false,
      toolMetas: [{ toolName: "search", meta: "Found 3 results" }],
    });

    expect(payloads).toHaveLength(0);
  });
});
