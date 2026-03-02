import fs from "node:fs";
import path from "node:path";
import { openBoundaryFile } from "../../infra/boundary-file-read.js";

const MAX_CONTEXT_CHARS = 3000;
const MAX_READ_FILES_CHARS = 8000;

/**
 * Read critical sections from workspace AGENTS.md for post-compaction injection.
 * Returns formatted system event text, or null if no AGENTS.md or no relevant sections.
 */
export async function readPostCompactionContext(workspaceDir: string): Promise<string | null> {
  const agentsPath = path.join(workspaceDir, "AGENTS.md");

  try {
    const opened = await openBoundaryFile({
      absolutePath: agentsPath,
      rootPath: workspaceDir,
      boundaryLabel: "workspace root",
    });
    if (!opened.ok) {
      return null;
    }
    const content = (() => {
      try {
        return fs.readFileSync(opened.fd, "utf-8");
      } finally {
        fs.closeSync(opened.fd);
      }
    })();

    // Extract "## Session Startup" and "## Red Lines" sections
    // Each section ends at the next "## " heading or end of file
    const sections = extractSections(content, ["Session Startup", "Red Lines"]);

    if (sections.length === 0) {
      return null;
    }

    const combined = sections.join("\n\n");
    const safeContent =
      combined.length > MAX_CONTEXT_CHARS
        ? combined.slice(0, MAX_CONTEXT_CHARS) + "\n...[truncated]..."
        : combined;

    return (
      "[Post-compaction context refresh]\n\n" +
      "Session was just compacted. The conversation summary above is a hint, NOT a substitute for your startup sequence. " +
      "Execute your Session Startup sequence now — read the required files before responding to the user.\n\n" +
      "Critical rules from AGENTS.md:\n\n" +
      safeContent
    );
  } catch {
    return null;
  }
}

/**
 * Read configured files from the workspace after compaction.
 * Each file path is resolved relative to workspaceDir with boundary checks.
 */
export async function readPostCompactionFiles(
  workspaceDir: string,
  readFiles: string[],
): Promise<string | null> {
  if (!readFiles || readFiles.length === 0) {
    return null;
  }

  const parts: string[] = [];
  let totalChars = 0;

  for (const relPath of readFiles) {
    const trimmed = relPath.trim();
    if (!trimmed) {
      continue;
    }
    const resolved = path.resolve(workspaceDir, trimmed);
    if (!resolved.startsWith(path.resolve(workspaceDir))) {
      continue;
    }
    try {
      const content = await fs.promises.readFile(resolved, "utf-8");
      const safe =
        totalChars + content.length > MAX_READ_FILES_CHARS
          ? content.slice(0, MAX_READ_FILES_CHARS - totalChars) + "\n...[truncated]..."
          : content;
      parts.push(`### ${trimmed}\n\n${safe}`);
      totalChars += safe.length;
      if (totalChars >= MAX_READ_FILES_CHARS) {
        break;
      }
    } catch {
      // File not found or unreadable — skip silently.
    }
  }

  if (parts.length === 0) {
    return null;
  }

  return (
    "[Post-compaction file restore]\n\n" +
    "The following files were automatically re-loaded after compaction " +
    "(configured via compaction.onCompact.readFiles):\n\n" +
    parts.join("\n\n")
  );
}

/**
 * Extract named sections from markdown content.
 * Matches H2 (##) or H3 (###) headings case-insensitively.
 * Skips content inside fenced code blocks.
 * Captures until the next heading of same or higher level, or end of string.
 */
export function extractSections(content: string, sectionNames: string[]): string[] {
  const results: string[] = [];
  const lines = content.split("\n");

  for (const name of sectionNames) {
    let sectionLines: string[] = [];
    let inSection = false;
    let sectionLevel = 0;
    let inCodeBlock = false;

    for (const line of lines) {
      // Track fenced code blocks
      if (line.trimStart().startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        if (inSection) {
          sectionLines.push(line);
        }
        continue;
      }

      // Skip heading detection inside code blocks
      if (inCodeBlock) {
        if (inSection) {
          sectionLines.push(line);
        }
        continue;
      }

      // Check if this line is a heading
      const headingMatch = line.match(/^(#{2,3})\s+(.+?)\s*$/);

      if (headingMatch) {
        const level = headingMatch[1].length; // 2 or 3
        const headingText = headingMatch[2];

        if (!inSection) {
          // Check if this is our target section (case-insensitive)
          if (headingText.toLowerCase() === name.toLowerCase()) {
            inSection = true;
            sectionLevel = level;
            sectionLines = [line];
            continue;
          }
        } else {
          // We're in section — stop if we hit a heading of same or higher level
          if (level <= sectionLevel) {
            break;
          }
          // Lower-level heading (e.g., ### inside ##) — include it
          sectionLines.push(line);
          continue;
        }
      }

      if (inSection) {
        sectionLines.push(line);
      }
    }

    if (sectionLines.length > 0) {
      results.push(sectionLines.join("\n").trim());
    }
  }

  return results;
}
