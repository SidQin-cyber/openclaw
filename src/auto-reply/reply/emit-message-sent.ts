import { createInternalHookEvent, triggerInternalHook } from "../../hooks/internal-hooks.js";
import { getGlobalHookRunner } from "../../plugins/hook-runner-global.js";
import type { ReplyPayload } from "../types.js";
import type { ReplyDispatchDeliveredHandler, ReplyDispatchKind } from "./reply-dispatcher.js";

export type MessageSentHookContext = {
  sessionKey: string;
  channel: string;
  to: string;
  accountId?: string;
};

/**
 * Creates an `onDelivered` callback for `ReplyDispatcherOptions` that emits
 * both the plugin `message_sent` hook and the internal `message:sent` hook
 * after each delivery attempt.
 */
export function createMessageSentEmitter(
  ctx: MessageSentHookContext,
): ReplyDispatchDeliveredHandler {
  return (
    payload: ReplyPayload,
    info: { kind: ReplyDispatchKind; success: boolean; error?: string },
  ) => {
    const content = [
      payload.text ?? "",
      ...(payload.mediaUrls ?? (payload.mediaUrl ? [payload.mediaUrl] : [])),
    ]
      .filter(Boolean)
      .join("\n");

    const hookRunner = getGlobalHookRunner();
    if (hookRunner?.hasHooks("message_sent")) {
      void hookRunner
        .runMessageSent(
          {
            to: ctx.to,
            content,
            success: info.success,
            ...(info.error ? { error: info.error } : {}),
          },
          {
            channelId: ctx.channel,
            accountId: ctx.accountId,
            conversationId: ctx.to,
          },
        )
        .catch(() => {});
    }

    void triggerInternalHook(
      createInternalHookEvent("message", "sent", ctx.sessionKey, {
        to: ctx.to,
        content,
        success: info.success,
        ...(info.error ? { error: info.error } : {}),
        channelId: ctx.channel,
        accountId: ctx.accountId,
        conversationId: ctx.to,
      }),
    ).catch(() => {});
  };
}
