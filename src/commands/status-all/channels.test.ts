import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../channels/plugins/index.js", () => ({
  listChannelPlugins: vi.fn(() => []),
}));

vi.mock("../../channels/plugins/helpers.js", () => ({
  resolveChannelDefaultAccountId: vi.fn(() => "default"),
}));

vi.mock("../../channels/account-summary.js", () => ({
  buildChannelAccountSnapshot: vi.fn(
    (params: { accountId: string; enabled: boolean; configured: boolean }) => ({
      accountId: params.accountId,
      enabled: params.enabled,
      configured: params.configured,
    }),
  ),
  formatChannelAllowFrom: vi.fn(() => []),
  resolveChannelAccountEnabled: vi.fn(() => true),
  resolveChannelAccountConfigured: vi.fn(async () => true),
}));

const { listChannelPlugins } = await import("../../channels/plugins/index.js");
const { buildChannelsTable } = await import("./channels.js");

function createThrowingPlugin() {
  return {
    id: "telegram",
    meta: {
      id: "telegram",
      label: "Telegram",
      selectionLabel: "Telegram",
      docsPath: "/telegram",
      blurb: "mock",
    },
    config: {
      listAccountIds: () => ["default"],
      resolveAccount: () => {
        throw new Error(
          'channels.telegram.botToken: unresolved SecretRef "env:MY_TOKEN". Resolve this command against an active gateway runtime snapshot before reading it.',
        );
      },
    },
  };
}

function createWorkingPlugin() {
  return {
    id: "discord",
    meta: {
      id: "discord",
      label: "Discord",
      selectionLabel: "Discord",
      docsPath: "/discord",
      blurb: "mock",
    },
    config: {
      listAccountIds: () => ["default"],
      resolveAccount: () => ({ enabled: true, configured: true }),
    },
  };
}

describe("buildChannelsTable resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("produces a degraded row when resolveAccount throws due to unresolved SecretRef", async () => {
    const throwingPlugin = createThrowingPlugin();
    (listChannelPlugins as ReturnType<typeof vi.fn>).mockReturnValue([throwingPlugin]);

    const result = await buildChannelsTable({} as never);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.id).toBe("telegram");
    expect(result.rows[0]?.state).toBe("warn");
    expect(result.rows[0]?.enabled).toBe(false);
    expect(result.rows[0]?.detail).toContain("unresolved SecretRef");
  });

  it("does not crash when one plugin throws and another succeeds", async () => {
    const throwingPlugin = createThrowingPlugin();
    const workingPlugin = createWorkingPlugin();
    (listChannelPlugins as ReturnType<typeof vi.fn>).mockReturnValue([
      throwingPlugin,
      workingPlugin,
    ]);

    const result = await buildChannelsTable({} as never);

    expect(result.rows).toHaveLength(2);
    const telegramRow = result.rows.find((r) => r.id === "telegram");
    const discordRow = result.rows.find((r) => r.id === "discord");
    expect(telegramRow?.state).toBe("warn");
    expect(discordRow).toBeDefined();
  });

  it("marks degraded account as disabled", async () => {
    const throwingPlugin = createThrowingPlugin();
    (listChannelPlugins as ReturnType<typeof vi.fn>).mockReturnValue([throwingPlugin]);

    const result = await buildChannelsTable({} as never);

    expect(result.rows[0]?.enabled).toBe(false);
  });
});
