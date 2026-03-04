import { describe, expect, it } from "vitest";
import { computeJobNextRunAtMs } from "./service/jobs.js";
import type { CronJob } from "./types.js";

const EVERY_24H_MS = 24 * 60 * 60_000;
const ANCHOR_7AM = Date.parse("2026-03-04T07:00:00.000Z");

function createDailyJob(state: CronJob["state"]): CronJob {
  return {
    id: "morning-affirmation",
    name: "Morning Affirmation",
    enabled: true,
    createdAtMs: ANCHOR_7AM,
    updatedAtMs: ANCHOR_7AM,
    schedule: { kind: "every", everyMs: EVERY_24H_MS, anchorMs: ANCHOR_7AM },
    sessionTarget: "isolated",
    wakeMode: "next-heartbeat",
    payload: { kind: "agentTurn", message: "morning check" },
    delivery: { mode: "none" },
    state,
  };
}

describe("Cron issue #33940: manual run should not shift every schedule", () => {
  it("without skipLastRunAnchor, next run anchors to lastRunAtMs (broken behavior)", () => {
    const manualRunAt = Date.parse("2026-03-04T13:00:00.000Z");
    const job = createDailyJob({ lastRunAtMs: manualRunAt });
    const nowMs = manualRunAt + 1000;

    const next = computeJobNextRunAtMs(job, nowMs);
    expect(next).toBe(manualRunAt + EVERY_24H_MS);
  });

  it("with skipLastRunAnchor, next run uses anchor (correct behavior)", () => {
    const manualRunAt = Date.parse("2026-03-04T13:00:00.000Z");
    const job = createDailyJob({ lastRunAtMs: manualRunAt });
    const nowMs = manualRunAt + 1000;

    const next = computeJobNextRunAtMs(job, nowMs, { skipLastRunAnchor: true });
    expect(next).toBe(Date.parse("2026-03-05T07:00:00.000Z"));
  });

  it("scheduled run still uses lastRunAtMs anchor (no regression)", () => {
    const scheduledRunAt = Date.parse("2026-03-04T07:00:00.000Z");
    const job = createDailyJob({ lastRunAtMs: scheduledRunAt });
    const nowMs = scheduledRunAt + 1000;

    const next = computeJobNextRunAtMs(job, nowMs);
    expect(next).toBe(scheduledRunAt + EVERY_24H_MS);
  });

  it("skipLastRunAnchor with no lastRunAtMs falls back to anchor", () => {
    const job = createDailyJob({ lastRunAtMs: undefined });
    const nowMs = Date.parse("2026-03-04T10:00:00.000Z");

    const next = computeJobNextRunAtMs(job, nowMs, { skipLastRunAnchor: true });
    expect(next).toBe(Date.parse("2026-03-05T07:00:00.000Z"));
  });

  it("cron schedule is unaffected by skipLastRunAnchor", () => {
    const job: CronJob = {
      id: "cron-7am",
      name: "Daily 7am cron",
      enabled: true,
      createdAtMs: Date.parse("2026-03-01T00:00:00.000Z"),
      updatedAtMs: Date.parse("2026-03-01T00:00:00.000Z"),
      schedule: { kind: "cron", expr: "0 7 * * *" },
      sessionTarget: "isolated",
      wakeMode: "next-heartbeat",
      payload: { kind: "agentTurn", message: "check" },
      delivery: { mode: "none" },
      state: { lastRunAtMs: Date.parse("2026-03-04T13:00:00.000Z") },
    };
    const nowMs = Date.parse("2026-03-04T13:01:00.000Z");

    const withFlag = computeJobNextRunAtMs(job, nowMs, { skipLastRunAnchor: true });
    const without = computeJobNextRunAtMs(job, nowMs);
    expect(withFlag).toBe(without);
  });
});
