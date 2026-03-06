import { describe, it, expect } from "vitest";
import { extractToolCards } from "./tool-cards.ts";
import { extractRawText } from "./message-extract.ts";

describe("extractToolCards (#38223)", () => {
  it("extracts text from toolResult with array content blocks", () => {
    const message = {
      role: "toolResult",
      toolCallId: "call_1",
      toolName: "exec",
      content: [{ type: "text", text: "file1.txt\nfile2.txt" }],
    };
    const cards = extractToolCards(message);
    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe("result");
    expect(cards[0].text).toContain("file1.txt");
  });

  it("extracts text from inline tool_result block with array content", () => {
    const message = {
      role: "assistant",
      content: [
        {
          type: "tool_result",
          name: "exec",
          content: [{ type: "text", text: "Hello World" }],
        },
      ],
    };
    const cards = extractToolCards(message);
    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe("result");
    expect(cards[0].text).toBe("Hello World");
  });

  it("extracts text from inline tool_result block with string content", () => {
    const message = {
      role: "assistant",
      content: [
        {
          type: "tool_result",
          name: "exec",
          content: "Hello World",
        },
      ],
    };
    const cards = extractToolCards(message);
    expect(cards).toHaveLength(1);
    expect(cards[0].text).toBe("Hello World");
  });

  it("joins multiple content blocks in tool_result", () => {
    const message = {
      role: "assistant",
      content: [
        {
          type: "tool_result",
          name: "exec",
          content: [
            { type: "text", text: "line1" },
            { type: "text", text: "line2" },
          ],
        },
      ],
    };
    const cards = extractToolCards(message);
    expect(cards).toHaveLength(1);
    expect(cards[0].text).toBe("line1\nline2");
  });

  it("handles content blocks without type field", () => {
    const message = {
      role: "assistant",
      content: [
        {
          type: "tool_result",
          name: "exec",
          content: [{ text: "output without type" }],
        },
      ],
    };
    const cards = extractToolCards(message);
    expect(cards).toHaveLength(1);
    expect(cards[0].text).toBe("output without type");
  });

  it("returns undefined text when content array is empty", () => {
    const message = {
      role: "assistant",
      content: [
        {
          type: "tool_result",
          name: "exec",
          content: [],
        },
      ],
    };
    const cards = extractToolCards(message);
    expect(cards).toHaveLength(1);
    expect(cards[0].text).toBeUndefined();
  });

  it("extracts tool call cards from assistant message", () => {
    const message = {
      role: "assistant",
      content: [
        { type: "tool_use", name: "exec", arguments: { command: "ls" } },
      ],
    };
    const cards = extractToolCards(message);
    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe("call");
    expect(cards[0].name).toBe("exec");
  });
});

describe("extractRawText — toolResult content edge cases (#38223)", () => {
  it("extracts text from content blocks without type field", () => {
    const message = {
      role: "toolResult",
      toolName: "exec",
      content: [{ text: "output without type" }],
    };
    const text = extractRawText(message);
    expect(text).toBe("output without type");
  });

  it("extracts text from standard typed content blocks", () => {
    const message = {
      role: "toolResult",
      content: [{ type: "text", text: "typed output" }],
    };
    const text = extractRawText(message);
    expect(text).toBe("typed output");
  });

  it("skips non-text typed content blocks", () => {
    const message = {
      role: "toolResult",
      content: [
        { type: "image", url: "https://example.com/img.png" },
        { type: "text", text: "visible" },
      ],
    };
    const text = extractRawText(message);
    expect(text).toBe("visible");
  });
});
