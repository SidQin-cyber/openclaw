import { describe, expect, it, vi } from "vitest";
import { retryAsync } from "./retry.js";
import { createAiProviderRetryRunner } from "./retry-policy.js";

async function runRetryAfterCase(params: {
  minDelayMs: number;
  maxDelayMs: number;
  retryAfterMs: number;
}): Promise<number[]> {
  vi.useFakeTimers();
  try {
    const fn = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ok");
    const delays: number[] = [];
    const promise = retryAsync(fn, {
      attempts: 2,
      minDelayMs: params.minDelayMs,
      maxDelayMs: params.maxDelayMs,
      jitter: 0,
      retryAfterMs: () => params.retryAfterMs,
      onRetry: (info) => delays.push(info.delayMs),
    });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("ok");
    return delays;
  } finally {
    vi.useRealTimers();
  }
}

describe("retryAsync", () => {
  it("returns on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await retryAsync(fn, 3, 10);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries then succeeds", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("fail1")).mockResolvedValueOnce("ok");
    const result = await retryAsync(fn, 3, 1);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("propagates after exhausting retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(retryAsync(fn, 2, 1)).rejects.toThrow("boom");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("stops when shouldRetry returns false", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(retryAsync(fn, { attempts: 3, shouldRetry: () => false })).rejects.toThrow("boom");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("calls onRetry before retrying", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ok");
    const onRetry = vi.fn();
    const res = await retryAsync(fn, {
      attempts: 2,
      minDelayMs: 0,
      maxDelayMs: 0,
      onRetry,
    });
    expect(res).toBe("ok");
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1, maxAttempts: 2 }));
  });

  it("clamps attempts to at least 1", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(retryAsync(fn, { attempts: 0, minDelayMs: 0, maxDelayMs: 0 })).rejects.toThrow(
      "boom",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("uses retryAfterMs when provided", async () => {
    const delays = await runRetryAfterCase({ minDelayMs: 0, maxDelayMs: 1000, retryAfterMs: 500 });
    expect(delays[0]).toBe(500);
  });

  it("clamps retryAfterMs to maxDelayMs", async () => {
    const delays = await runRetryAfterCase({ minDelayMs: 0, maxDelayMs: 100, retryAfterMs: 500 });
    expect(delays[0]).toBe(100);
  });

  it("clamps retryAfterMs to minDelayMs", async () => {
    const delays = await runRetryAfterCase({ minDelayMs: 250, maxDelayMs: 1000, retryAfterMs: 50 });
    expect(delays[0]).toBe(250);
  });

  it("respects abortSignal during retry delay", async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new Error("rate limit 429"));

    const promise = retryAsync(fn, {
      attempts: 5,
      minDelayMs: 50_000,
      maxDelayMs: 100_000,
      jitter: 0,
      abortSignal: controller.signal,
    });

    setTimeout(() => controller.abort(), 50);

    await expect(promise).rejects.toThrow();
    expect(fn.mock.calls.length).toBeLessThan(5);
  });
});

describe("createAiProviderRetryRunner", () => {
  it("retries on 429 rate limit errors", async () => {
    const runner = createAiProviderRetryRunner({
      retry: { attempts: 3, minDelayMs: 1, maxDelayMs: 10, jitter: 0 },
    });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("HTTP 429 Too Many Requests"))
      .mockResolvedValueOnce("ok");
    const result = await runner(fn, "test-429");
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on overloaded errors", async () => {
    const runner = createAiProviderRetryRunner({
      retry: { attempts: 3, minDelayMs: 1, maxDelayMs: 10, jitter: 0 },
    });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("529 overloaded"))
      .mockResolvedValueOnce("done");
    const result = await runner(fn, "test-529");
    expect(result).toBe("done");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry on non-transient errors", async () => {
    const runner = createAiProviderRetryRunner({
      retry: { attempts: 3, minDelayMs: 1, maxDelayMs: 10, jitter: 0 },
    });
    const fn = vi.fn().mockRejectedValue(new Error("invalid API key"));
    await expect(runner(fn, "test-auth")).rejects.toThrow("invalid API key");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("exhausts retries and throws on persistent rate limits", async () => {
    const runner = createAiProviderRetryRunner({
      retry: { attempts: 3, minDelayMs: 1, maxDelayMs: 10, jitter: 0 },
    });
    const fn = vi.fn().mockRejectedValue(new Error("HTTP 429 rate limit"));
    await expect(runner(fn, "test-exhaust")).rejects.toThrow("429");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
