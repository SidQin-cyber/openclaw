import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openVerifiedFileSync } from "./safe-open-sync.js";

async function withTempDir<T>(prefix: string, run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await run(dir);
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
}

describe("openVerifiedFileSync", () => {
  it("rejects directories by default", async () => {
    await withTempDir("openclaw-safe-open-", async (root) => {
      const targetDir = path.join(root, "nested");
      await fsp.mkdir(targetDir, { recursive: true });

      const opened = openVerifiedFileSync({ filePath: targetDir });
      expect(opened.ok).toBe(false);
      if (!opened.ok) {
        expect(opened.reason).toBe("validation");
      }
    });
  });

  it("accepts directories when allowedType is directory", async () => {
    await withTempDir("openclaw-safe-open-", async (root) => {
      const targetDir = path.join(root, "nested");
      await fsp.mkdir(targetDir, { recursive: true });

      const opened = openVerifiedFileSync({
        filePath: targetDir,
        allowedType: "directory",
        rejectHardlinks: true,
      });
      expect(opened.ok).toBe(true);
      if (!opened.ok) {
        return;
      }
      expect(opened.stat.isDirectory()).toBe(true);
      expect(opened.fd).toBe(-1);
    });
  });

  it("returns fd=-1 for directory without calling openSync", async () => {
    await withTempDir("openclaw-safe-open-", async (root) => {
      const targetDir = path.join(root, "subdir");
      await fsp.mkdir(targetDir, { recursive: true });

      const openSyncCalls: string[] = [];
      const mockFs: Parameters<typeof openVerifiedFileSync>[0]["ioFs"] = {
        constants: fs.constants,
        lstatSync: fs.lstatSync.bind(fs),
        realpathSync: fs.realpathSync.bind(fs),
        openSync: (...args: Parameters<typeof fs.openSync>) => {
          openSyncCalls.push(String(args[0]));
          return fs.openSync(...args);
        },
        fstatSync: fs.fstatSync.bind(fs),
        closeSync: fs.closeSync.bind(fs),
      };

      const opened = openVerifiedFileSync({
        filePath: targetDir,
        allowedType: "directory",
        ioFs: mockFs,
      });
      expect(opened.ok).toBe(true);
      if (!opened.ok) {
        return;
      }
      expect(opened.fd).toBe(-1);
      expect(openSyncCalls).toHaveLength(0);
    });
  });
});
