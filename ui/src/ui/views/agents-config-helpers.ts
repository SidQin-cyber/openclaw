type AgentsConfig = { agents?: { list?: unknown[] } };

export function ensureAgentInConfigList(
  configValue: Record<string, unknown> | null,
  agentId: string,
): number {
  if (!configValue) {
    return -1;
  }
  const cfg = configValue as AgentsConfig;
  if (!cfg.agents) {
    configValue.agents = { list: [{ id: agentId }] };
    return 0;
  }
  if (!Array.isArray(cfg.agents.list)) {
    cfg.agents.list = [{ id: agentId }];
    return 0;
  }
  const index = cfg.agents.list.findIndex(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      "id" in entry &&
      (entry as { id?: string }).id === agentId,
  );
  if (index >= 0) {
    return index;
  }
  cfg.agents.list.push({ id: agentId });
  return cfg.agents.list.length - 1;
}
