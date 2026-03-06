import { RateLimitError } from "@buape/carbon";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { formatErrorMessage } from "./errors.js";
import { type RetryConfig, resolveRetryConfig, retryAsync } from "./retry.js";

export type RetryRunner = <T>(fn: () => Promise<T>, label?: string) => Promise<T>;
export type AbortableRetryRunner = <T>(
  fn: () => Promise<T>,
  label?: string,
  abortSignal?: AbortSignal,
) => Promise<T>;

export const DISCORD_RETRY_DEFAULTS = {
  attempts: 3,
  minDelayMs: 500,
  maxDelayMs: 30_000,
  jitter: 0.1,
};

export const TELEGRAM_RETRY_DEFAULTS = {
  attempts: 3,
  minDelayMs: 400,
  maxDelayMs: 30_000,
  jitter: 0.1,
};

const TELEGRAM_RETRY_RE = /429|timeout|connect|reset|closed|unavailable|temporarily/i;
const log = createSubsystemLogger("retry-policy");

function getTelegramRetryAfterMs(err: unknown): number | undefined {
  if (!err || typeof err !== "object") {
    return undefined;
  }
  const candidate =
    "parameters" in err && err.parameters && typeof err.parameters === "object"
      ? (err.parameters as { retry_after?: unknown }).retry_after
      : "response" in err &&
          err.response &&
          typeof err.response === "object" &&
          "parameters" in err.response
        ? (
            err.response as {
              parameters?: { retry_after?: unknown };
            }
          ).parameters?.retry_after
        : "error" in err && err.error && typeof err.error === "object" && "parameters" in err.error
          ? (err.error as { parameters?: { retry_after?: unknown } }).parameters?.retry_after
          : undefined;
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate * 1000 : undefined;
}

export function createDiscordRetryRunner(params: {
  retry?: RetryConfig;
  configRetry?: RetryConfig;
  verbose?: boolean;
}): RetryRunner {
  const retryConfig = resolveRetryConfig(DISCORD_RETRY_DEFAULTS, {
    ...params.configRetry,
    ...params.retry,
  });
  return <T>(fn: () => Promise<T>, label?: string) =>
    retryAsync(fn, {
      ...retryConfig,
      label,
      shouldRetry: (err) => err instanceof RateLimitError,
      retryAfterMs: (err) => (err instanceof RateLimitError ? err.retryAfter * 1000 : undefined),
      onRetry: params.verbose
        ? (info) => {
            const labelText = info.label ?? "request";
            const maxRetries = Math.max(1, info.maxAttempts - 1);
            log.warn(
              `discord ${labelText} rate limited, retry ${info.attempt}/${maxRetries} in ${info.delayMs}ms`,
            );
          }
        : undefined,
    });
}

export const AI_PROVIDER_RETRY_DEFAULTS = {
  attempts: 4,
  minDelayMs: 1_000,
  maxDelayMs: 60_000,
  jitter: 0.15,
};

const AI_PROVIDER_RETRY_RE = /429|rate.?limit|too many requests|overloaded|529|service unavailable/i;

function getAiProviderRetryAfterMs(err: unknown): number | undefined {
  if (!err || typeof err !== "object") {
    return undefined;
  }
  const headers =
    "headers" in err && err.headers && typeof err.headers === "object"
      ? (err.headers as Record<string, unknown>)
      : "response" in err &&
          err.response &&
          typeof err.response === "object" &&
          "headers" in err.response
        ? (err.response as { headers?: Record<string, unknown> }).headers
        : undefined;
  if (!headers) {
    return undefined;
  }
  const raw =
    headers["retry-after"] ?? headers["Retry-After"] ?? headers["x-ratelimit-reset-requests"];
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw > 1000 ? raw : raw * 1000;
  }
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return parsed > 1000 ? parsed : parsed * 1000;
    }
  }
  return undefined;
}

export function createAiProviderRetryRunner(params: {
  retry?: RetryConfig;
  verbose?: boolean;
}): AbortableRetryRunner {
  const retryConfig = resolveRetryConfig(AI_PROVIDER_RETRY_DEFAULTS, params.retry);
  return <T>(fn: () => Promise<T>, label?: string, abortSignal?: AbortSignal) =>
    retryAsync(fn, {
      ...retryConfig,
      label,
      abortSignal,
      shouldRetry: (err) => AI_PROVIDER_RETRY_RE.test(formatErrorMessage(err)),
      retryAfterMs: getAiProviderRetryAfterMs,
      onRetry: params.verbose
        ? (info) => {
            const maxRetries = Math.max(1, info.maxAttempts - 1);
            log.warn(
              `AI provider ${info.label ?? label ?? "request"} retry ${info.attempt}/${maxRetries} in ${info.delayMs}ms: ${formatErrorMessage(info.err)}`,
            );
          }
        : undefined,
    });
}

export function createTelegramRetryRunner(params: {
  retry?: RetryConfig;
  configRetry?: RetryConfig;
  verbose?: boolean;
  shouldRetry?: (err: unknown) => boolean;
}): RetryRunner {
  const retryConfig = resolveRetryConfig(TELEGRAM_RETRY_DEFAULTS, {
    ...params.configRetry,
    ...params.retry,
  });
  const shouldRetry = params.shouldRetry
    ? (err: unknown) => params.shouldRetry?.(err) || TELEGRAM_RETRY_RE.test(formatErrorMessage(err))
    : (err: unknown) => TELEGRAM_RETRY_RE.test(formatErrorMessage(err));

  return <T>(fn: () => Promise<T>, label?: string) =>
    retryAsync(fn, {
      ...retryConfig,
      label,
      shouldRetry,
      retryAfterMs: getTelegramRetryAfterMs,
      onRetry: params.verbose
        ? (info) => {
            const maxRetries = Math.max(1, info.maxAttempts - 1);
            log.warn(
              `telegram send retry ${info.attempt}/${maxRetries} for ${info.label ?? label ?? "request"} in ${info.delayMs}ms: ${formatErrorMessage(info.err)}`,
            );
          }
        : undefined,
    });
}
