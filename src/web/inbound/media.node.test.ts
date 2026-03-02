import { describe, expect, it, vi } from "vitest";

const { normalizeMessageContent, downloadMediaMessage } = vi.hoisted(() => ({
  normalizeMessageContent: vi.fn((msg: unknown) => msg),
  downloadMediaMessage: vi.fn().mockResolvedValue(Buffer.from("fake-media-data")),
}));

vi.mock("@whiskeysockets/baileys", () => ({
  normalizeMessageContent,
  downloadMediaMessage,
}));

import { downloadInboundMedia } from "./media.js";

const mockSock = {
  updateMediaMessage: vi.fn(),
  logger: { child: () => ({}) },
} as never;

async function expectMimetype(message: Record<string, unknown>, expected: string) {
  const result = await downloadInboundMedia({ message } as never, mockSock);
  expect(result).toBeDefined();
  expect(result?.mimetype).toBe(expected);
}

describe("downloadInboundMedia", () => {
  it("returns undefined for messages without media", async () => {
    const msg = { message: { conversation: "hello" } } as never;
    const result = await downloadInboundMedia(msg, mockSock);
    expect(result).toBeUndefined();
  });

  it("uses explicit mimetype from audioMessage when present", async () => {
    await expectMimetype({ audioMessage: { mimetype: "audio/mp4", ptt: true } }, "audio/mp4");
  });

  it.each([
    { name: "voice messages without explicit MIME", audioMessage: { ptt: true } },
    { name: "audio messages without MIME or ptt flag", audioMessage: {} },
  ])("defaults to audio/ogg for $name", async ({ audioMessage }) => {
    await expectMimetype({ audioMessage }, "audio/ogg; codecs=opus");
  });

  it("uses explicit mimetype from imageMessage when present", async () => {
    await expectMimetype({ imageMessage: { mimetype: "image/png" } }, "image/png");
  });

  it.each([
    { name: "image", message: { imageMessage: {} }, mimetype: "image/jpeg" },
    { name: "video", message: { videoMessage: {} }, mimetype: "video/mp4" },
    { name: "sticker", message: { stickerMessage: {} }, mimetype: "image/webp" },
  ])("defaults MIME for $name messages without explicit MIME", async ({ message, mimetype }) => {
    await expectMimetype(message, mimetype);
  });

  it("preserves fileName from document messages", async () => {
    const msg = {
      message: {
        documentMessage: { mimetype: "application/pdf", fileName: "report.pdf" },
      },
    } as never;
    const result = await downloadInboundMedia(msg, mockSock);
    expect(result).toBeDefined();
    expect(result?.mimetype).toBe("application/pdf");
    expect(result?.fileName).toBe("report.pdf");
  });

  it("strips thumbnailDirectPath from audioMessage to prevent waveform download", async () => {
    downloadMediaMessage.mockClear();
    const msg = {
      message: {
        audioMessage: {
          ptt: true,
          mimetype: "audio/ogg; codecs=opus",
          directPath: "/full-audio-path",
          thumbnailDirectPath: "/waveform-thumbnail",
          mediaKey: Buffer.from("key"),
        },
      },
    } as never;
    await downloadInboundMedia(msg, mockSock);
    expect(downloadMediaMessage).toHaveBeenCalledOnce();
    const passedMsg = downloadMediaMessage.mock.calls[0][0];
    expect(passedMsg.message.audioMessage.directPath).toBe("/full-audio-path");
    expect(passedMsg.message.audioMessage.thumbnailDirectPath).toBeUndefined();
  });

  it("does not strip thumbnailDirectPath from non-audio messages", async () => {
    downloadMediaMessage.mockClear();
    const msg = {
      message: {
        imageMessage: {
          mimetype: "image/jpeg",
          directPath: "/image-path",
          thumbnailDirectPath: "/thumb-path",
        },
      },
    } as never;
    await downloadInboundMedia(msg, mockSock);
    expect(downloadMediaMessage).toHaveBeenCalledOnce();
    const passedMsg = downloadMediaMessage.mock.calls[0][0];
    expect(passedMsg.message.imageMessage.thumbnailDirectPath).toBe("/thumb-path");
  });
});
