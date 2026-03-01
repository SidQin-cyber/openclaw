import { discoverOpenClawPlugins } from "./discovery.js";
import { loadPluginManifest } from "./manifest.js";

export type BundledPluginSource = {
  pluginId: string;
  localPath: string;
  npmSpec?: string;
};

function extractRegistryPackageName(spec: string): string {
  const trimmed = spec.trim();
  if (!trimmed) {
    return "";
  }
  const lastAt = trimmed.lastIndexOf("@");
  if (lastAt > 0) {
    return trimmed.slice(0, lastAt);
  }
  return trimmed;
}

function collectBundledLookupKeys(params: { pluginId: string; npmSpec?: string }): Set<string> {
  const keys = new Set<string>();
  const pluginId = params.pluginId.trim().toLowerCase();
  if (pluginId) {
    keys.add(pluginId);
    keys.add(`@openclaw/${pluginId}`);
  }
  const npmSpec = params.npmSpec?.trim().toLowerCase() ?? "";
  if (npmSpec) {
    keys.add(npmSpec);
    const pkg = extractRegistryPackageName(npmSpec);
    if (pkg) {
      keys.add(pkg);
      if (pkg.startsWith("@openclaw/")) {
        const short = pkg.slice("@openclaw/".length).trim();
        if (short) {
          keys.add(short);
        }
      }
    }
  }
  return keys;
}

export function resolveBundledPluginSources(params: {
  workspaceDir?: string;
}): Map<string, BundledPluginSource> {
  const discovery = discoverOpenClawPlugins({ workspaceDir: params.workspaceDir });
  const bundled = new Map<string, BundledPluginSource>();

  for (const candidate of discovery.candidates) {
    if (candidate.origin !== "bundled") {
      continue;
    }
    const manifest = loadPluginManifest(candidate.rootDir);
    if (!manifest.ok) {
      continue;
    }
    const pluginId = manifest.manifest.id;
    if (bundled.has(pluginId)) {
      continue;
    }

    const npmSpec =
      candidate.packageManifest?.install?.npmSpec?.trim() ||
      candidate.packageName?.trim() ||
      undefined;

    bundled.set(pluginId, {
      pluginId,
      localPath: candidate.rootDir,
      npmSpec,
    });
  }

  return bundled;
}

export function findBundledPluginByNpmSpec(params: {
  spec: string;
  workspaceDir?: string;
}): BundledPluginSource | undefined {
  const targetSpec = params.spec.trim().toLowerCase();
  if (!targetSpec) {
    return undefined;
  }
  const targetKeys = new Set<string>();
  targetKeys.add(targetSpec);
  const targetPackage = extractRegistryPackageName(targetSpec);
  if (targetPackage) {
    targetKeys.add(targetPackage);
    if (targetPackage.startsWith("@openclaw/")) {
      const short = targetPackage.slice("@openclaw/".length).trim();
      if (short) {
        targetKeys.add(short);
      }
    } else if (!targetPackage.includes("/") && !targetPackage.startsWith("@")) {
      targetKeys.add(`@openclaw/${targetPackage}`);
    }
  }

  const bundled = resolveBundledPluginSources({ workspaceDir: params.workspaceDir });
  for (const source of bundled.values()) {
    const sourceKeys = collectBundledLookupKeys({
      pluginId: source.pluginId,
      npmSpec: source.npmSpec,
    });
    for (const key of targetKeys) {
      if (sourceKeys.has(key)) {
        return source;
      }
    }
  }
  return undefined;
}
