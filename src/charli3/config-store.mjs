import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(moduleDir, "..", "..");
const configDir = path.join(rootDir, "oracle-configs");

let configCache = null;

export async function listOracleConfigs() {
  if (configCache) {
    return configCache;
  }

  const files = (await readdir(configDir))
    .filter((file) => file.endsWith(".json"))
    .sort();

  configCache = await Promise.all(
    files.map(async (file) => {
      const content = await readFile(path.join(configDir, file), "utf8");
      return JSON.parse(content);
    }),
  );

  return configCache;
}

export async function getOracleConfigById(id) {
  const configs = await listOracleConfigs();
  return configs.find((config) => config.id === id) ?? null;
}

export function summarizeOracleConfig(config) {
  return {
    id: config.id,
    pair: config.pair,
    displayName: config.displayName,
    network: config.network.name,
    oracleAddressShort: shortHash(config.oracleAddress, 12),
    policyIdShort: shortHash(config.policyId, 10),
    nodeCount: config.nodes.length,
    validityWindowMinutes: Math.round(config.odvValidityMs / 60000),
  };
}

export function shortHash(value, keep = 10) {
  if (!value) {
    return "n/a";
  }

  if (value.length <= keep * 2) {
    return value;
  }

  return `${value.slice(0, keep)}...${value.slice(-keep)}`;
}

