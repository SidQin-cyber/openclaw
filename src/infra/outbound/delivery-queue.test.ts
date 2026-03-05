import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { failDelivery } from "./delivery-queue.js";

describe("failDelivery", () => {
  it("does not throw when queue file contains malformed JSON", async () => {
    const tmpDir = fs.mkdtempSync(path.join("/tmp", "delivery-queue-test-"));
    const queueDir = path.join(tmpDir, "delivery-queue");
    fs.mkdirSync(queueDir, { recursive: true });

    const id = "bad-entry";
    fs.writeFileSync(path.join(queueDir, `${id}.json`), "NOT VALID JSON{{{", "utf-8");

    await expect(failDelivery(id, "test error", tmpDir)).resolves.toBeUndefined();

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("updates retry count for valid queue entry", async () => {
    const tmpDir = fs.mkdtempSync(path.join("/tmp", "delivery-queue-test-"));
    const queueDir = path.join(tmpDir, "delivery-queue");
    fs.mkdirSync(queueDir, { recursive: true });

    const id = "good-entry";
    const entry = {
      id,
      retryCount: 0,
      lastAttemptAt: 0,
      lastError: "",
      createdAt: Date.now(),
      delivery: { channel: "telegram", to: "+15550001111" },
      replies: [],
    };
    fs.writeFileSync(path.join(queueDir, `${id}.json`), JSON.stringify(entry), "utf-8");

    await failDelivery(id, "delivery failed", tmpDir);

    const updated = JSON.parse(fs.readFileSync(path.join(queueDir, `${id}.json`), "utf-8"));
    expect(updated.retryCount).toBe(1);
    expect(updated.lastError).toBe("delivery failed");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
