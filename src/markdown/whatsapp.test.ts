import { describe, expect, it } from "vitest";
import { markdownToWhatsApp } from "./whatsapp.js";

describe("markdownToWhatsApp", () => {
  it("handles common markdown-to-whatsapp conversions", () => {
    const cases = [
      ["converts **bold** to *bold*", "**SOD Blast:**", "*SOD Blast:*"],
      ["converts __bold__ to *bold*", "__important__", "*important*"],
      ["converts ~~strikethrough~~ to ~strikethrough~", "~~deleted~~", "~deleted~"],
      ["leaves single *italic* unchanged (already WhatsApp bold)", "*text*", "*text*"],
      ["leaves _italic_ unchanged (already WhatsApp italic)", "_text_", "_text_"],
      ["preserves inline code", "Use `**not bold**` here", "Use `**not bold**` here"],
      [
        "handles mixed formatting",
        "**bold** and ~~strike~~ and _italic_",
        "*bold* and ~strike~ and _italic_",
      ],
      ["handles multiple bold segments", "**one** then **two**", "*one* then *two*"],
      ["returns empty string for empty input", "", ""],
      ["returns plain text unchanged", "no formatting here", "no formatting here"],
      ["handles bold inside a sentence", "This is **very** important", "This is *very* important"],
    ] as const;
    for (const [name, input, expected] of cases) {
      expect(markdownToWhatsApp(input), name).toBe(expected);
    }
  });

  it("preserves fenced code blocks", () => {
    const input = "```\nconst x = **bold**;\n```";
    expect(markdownToWhatsApp(input)).toBe(input);
  });

  it("preserves code block with formatting inside", () => {
    const input = "Before ```**bold** and ~~strike~~``` after **real bold**";
    expect(markdownToWhatsApp(input)).toBe(
      "Before ```**bold** and ~~strike~~``` after *real bold*",
    );
  });

  it("converts HTML tags to WhatsApp-compatible text", () => {
    const cases = [
      ["converts <br> to newline", "line1<br>line2", "line1\nline2"],
      ["converts <br/> to newline", "line1<br/>line2", "line1\nline2"],
      ["converts <br /> to newline", "line1<br />line2", "line1\nline2"],
      ["converts <b> to bold markers", "<b>bold</b>", "*bold*"],
      ["converts <strong> to bold markers", "<strong>text</strong>", "*text*"],
      ["converts <i> to italic markers", "<i>italic</i>", "_italic_"],
      ["converts <em> to italic markers", "<em>text</em>", "_text_"],
      ["converts <s> to strikethrough markers", "<s>deleted</s>", "~deleted~"],
      ["converts <del> to strikethrough markers", "<del>removed</del>", "~removed~"],
      ["converts <a> to text with URL", '<a href="https://example.com">click</a>', "click (https://example.com)"],
      ["strips unknown HTML tags", "<div>content</div>", "content"],
      ["strips self-closing tags", "text<hr/>more", "textmore"],
    ] as const;
    for (const [name, input, expected] of cases) {
      expect(markdownToWhatsApp(input), name).toBe(expected);
    }
  });

  it("does not strip HTML tags inside code blocks", () => {
    const input = "```\n<br>tag\n```";
    expect(markdownToWhatsApp(input)).toBe(input);
  });
});
