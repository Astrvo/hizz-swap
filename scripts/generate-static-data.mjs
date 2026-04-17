import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  listOracleConfigs,
  shortHash,
  summarizeOracleConfig,
} from "../src/charli3/config-store.mjs";
import { ORACLE_SNAPSHOTS } from "../src/charli3/oracle-snapshots.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const dataDir = path.join(rootDir, "public", "data");
const outputPath = path.join(dataDir, "oracles.json");

const configs = await listOracleConfigs();
const cards = configs.map((config) => ({
  ...summarizeOracleConfig(config),
  mode: "oracle-first",
}));

const views = Object.fromEntries(
  configs.map((config) => {
    const snapshot = ORACLE_SNAPSHOTS[config.id] ?? {
      readiness: "config-only",
      source: "charli3-hackathon-config",
      note: "Static demo mode is using the official Charli3 market configuration while live feed hydration is not bundled into the Netlify publish step.",
      priceInteger: null,
      precision: 6,
      priceDisplay: null,
      createdAtMs: null,
      expiresAtMs: null,
    };

    const view = {
      ...summarizeOracleConfig(config),
      baseAsset: config.baseAsset,
      quoteAsset: config.quoteAsset,
      networkConfig: config.network,
      oracleAddress: config.oracleAddress,
      policyId: config.policyId,
      referenceScript: {
        address: config.referenceScript.address,
        addressShort: shortHash(config.referenceScript.address, 14),
        utxoReference: config.referenceScript.utxoReference,
      },
      nodes: config.nodes.map((node) => ({
        rootUrl: node.rootUrl,
        pubKey: node.pubKey,
        pubKeyShort: shortHash(node.pubKey, 12),
      })),
      source: config.source,
      notes: config.notes,
      oracle: {
        ...snapshot,
        fetchedAtMs: Date.now(),
        demoMode: "static-export",
      },
    };

    return [config.id, view];
  }),
);

await mkdir(dataDir, { recursive: true });
await writeFile(
  outputPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      mode: "static-demo",
      cards,
      views,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`Generated static oracle bundle at ${outputPath}`);

