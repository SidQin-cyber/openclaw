import { RequestClient } from "@buape/carbon";
import { ProxyAgent, fetch as undiciFetch } from "undici";
import { loadConfig } from "../config/config.js";
import { createDiscordRetryRunner, type RetryRunner } from "../infra/retry-policy.js";
import type { RetryConfig } from "../infra/retry.js";
import { resolveDiscordAccount } from "./accounts.js";
import { normalizeDiscordToken } from "./token.js";

export type DiscordClientOpts = {
  token?: string;
  accountId?: string;
  rest?: RequestClient;
  retry?: RetryConfig;
  verbose?: boolean;
};

function resolveToken(params: { explicit?: string; accountId: string; fallbackToken?: string }) {
  const explicit = normalizeDiscordToken(params.explicit, "channels.discord.token");
  if (explicit) {
    return explicit;
  }
  const fallback = normalizeDiscordToken(params.fallbackToken, "channels.discord.token");
  if (!fallback) {
    throw new Error(
      `Discord bot token missing for account "${params.accountId}" (set discord.accounts.${params.accountId}.token or DISCORD_BOT_TOKEN for default).`,
    );
  }
  return fallback;
}

function resolveRest(token: string, proxyUrl?: string, rest?: RequestClient) {
  if (rest) {
    return rest;
  }
  const proxy = proxyUrl?.trim();
  if (!proxy) {
    return new RequestClient(token);
  }
  return createProxyRequestClient(token, proxy);
}

function createProxyRequestClient(token: string, proxyUrl: string): RequestClient {
  const client = new RequestClient(token);
  const dispatcher = new ProxyAgent(proxyUrl);
  const parentExecute = client.executeRequest.bind(client);
  (client as { executeRequest: typeof client.executeRequest }).executeRequest = async (
    request: Parameters<RequestClient["executeRequest"]>[0],
  ) => {
    const savedFetch = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      undiciFetch(input as string | URL, {
        ...(init as Record<string, unknown>),
        dispatcher,
      }) as unknown as Promise<Response>) as typeof fetch;
    try {
      return await parentExecute(request);
    } finally {
      globalThis.fetch = savedFetch;
    }
  };
  return client;
}

export function createDiscordRestClient(opts: DiscordClientOpts, cfg = loadConfig()) {
  const account = resolveDiscordAccount({ cfg, accountId: opts.accountId });
  const token = resolveToken({
    explicit: opts.token,
    accountId: account.accountId,
    fallbackToken: account.token,
  });
  const proxyUrl = cfg.channels?.discord?.proxy;
  const rest = resolveRest(token, proxyUrl, opts.rest);
  return { token, rest, account };
}

export function createDiscordClient(
  opts: DiscordClientOpts,
  cfg = loadConfig(),
): { token: string; rest: RequestClient; request: RetryRunner } {
  const { token, rest, account } = createDiscordRestClient(opts, cfg);
  const request = createDiscordRetryRunner({
    retry: opts.retry,
    configRetry: account.config.retry,
    verbose: opts.verbose,
  });
  return { token, rest, request };
}

export function resolveDiscordRest(opts: DiscordClientOpts) {
  return createDiscordRestClient(opts).rest;
}
