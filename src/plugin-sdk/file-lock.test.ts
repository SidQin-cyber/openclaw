import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { acquireFileLock, type FileLockOptions } from "./file-lock.js";

const LOCK_OPTIONS: FileLockOptions = {
  retries: { retries: 0, factor: 1, minTimeout: 100, maxTimeout: 500 },
  stale: 30_000,
};

describe("acquireFileLock", () => {
  const cleanupPaths: string[] = [];

  afterEach(async () => {
    for (const p of cleanupPaths) {
      await fs.rm(p, { force: true, recursive: true }).catch(() => undefined);
    }
    cleanupPaths.length = 0;
  });

  it("redirects root-level lock files to os.tmpdir()", async () => {
    const fallbackDir = path.join(os.tmpdir(), "openclaw-locks");
    cleanupPaths.push(fallbackDir);

    const originalCwd = process.cwd();
    try {
      process.chdir("/");
      const lock = await acquireFileLock("file", LOCK_OPTIONS);
      expect(lock.lockPath).toBe(path.join(fallbackDir, "file.lock"));
      await lock.release();
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("creates lock in normal directory when not at root", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-lock-test-"));
    cleanupPaths.push(tmpDir);

    const filePath = path.join(tmpDir, "state");
    const lock = await acquireFileLock(filePath, LOCK_OPTIONS);
    expect(lock.lockPath).toContain("state.lock");
    expect(lock.lockPath).not.toContain("openclaw-locks");
    await lock.release();
  });
});
