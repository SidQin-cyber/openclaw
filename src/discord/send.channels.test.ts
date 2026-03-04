import { beforeEach, describe, expect, it, vi } from "vitest";

const patchMock = vi.fn();

vi.mock("./client.js", () => ({
  resolveDiscordRest: () => ({ patch: patchMock }),
}));

const { editChannelDiscord } = await import("./send.channels.js");

describe("editChannelDiscord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes applied_tags in request body when appliedTags is provided", async () => {
    patchMock.mockResolvedValueOnce({
      id: "thread-1",
      type: 11,
      applied_tags: ["tag-a", "tag-b"],
    });

    const result = await editChannelDiscord({
      channelId: "thread-1",
      appliedTags: ["tag-a", "tag-b"],
    });

    const body = patchMock.mock.calls[0]?.[1]?.body as Record<string, unknown>;
    expect(body).toEqual({ applied_tags: ["tag-a", "tag-b"] });
    expect(result).toMatchObject({ id: "thread-1" });
  });

  it("omits applied_tags when not provided", async () => {
    patchMock.mockResolvedValueOnce({ id: "ch-1" });

    await editChannelDiscord({ channelId: "ch-1", name: "renamed" });

    const body = patchMock.mock.calls[0]?.[1]?.body as Record<string, unknown>;
    expect(body.name).toBe("renamed");
    expect(body).not.toHaveProperty("applied_tags");
  });

  it("sends both availableTags and appliedTags when both provided", async () => {
    patchMock.mockResolvedValueOnce({ id: "forum-1" });

    await editChannelDiscord({
      channelId: "forum-1",
      availableTags: [{ name: "Bug" }],
      appliedTags: ["tag-1"],
    });

    const body = patchMock.mock.calls[0]?.[1]?.body as Record<string, unknown>;
    expect(body.available_tags).toEqual([{ name: "Bug" }]);
    expect(body.applied_tags).toEqual(["tag-1"]);
  });
});
