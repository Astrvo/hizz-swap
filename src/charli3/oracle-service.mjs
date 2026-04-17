import { ORACLE_SNAPSHOTS } from "./oracle-snapshots.mjs";
import {
  getOracleConfigById,
  listOracleConfigs,
  shortHash,
  summarizeOracleConfig,
} from "./config-store.mjs";

export async function listOracleCards() {
  const configs = await listOracleConfigs();
  return configs.map((config) => ({
    ...summarizeOracleConfig(config),
    mode: "oracle-first",
  }));
}

export async function getOracleView(id) {
  const config = await getOracleConfigById(id);

  if (!config) {
    return null;
  }

  const oracle = await readOracleFeed(config);

  return {
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
    oracle,
  };
}

async function readOracleFeed(config) {
  const endpoint = `${config.network.kupoUrl}/matches/${encodeURIComponent(config.oracleAddress)}?unspent&resolve_hashes`;

  try {
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(2500),
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Kupo responded with ${response.status}`);
    }

    const matches = await response.json();
    const parsed = parseLatestMatch(matches);

    if (!parsed) {
      throw new Error("No parseable oracle datum found at the configured address.");
    }

    return {
      readiness: "live",
      source: "charli3-preprod-kupo",
      note: "Live read hydrated from the public synced preprod Kupo instance.",
      kupoEndpoint: endpoint,
      fetchedAtMs: Date.now(),
      ...parsed,
    };
  } catch (error) {
    const snapshot = ORACLE_SNAPSHOTS[config.id];

    return {
      kupoEndpoint: endpoint,
      fetchedAtMs: Date.now(),
      error: error.message,
      ...(snapshot ?? {
        readiness: "config-only",
        source: "charli3-hackathon-config",
        note: "The official configuration is present, but this environment could not reach or parse the public preprod oracle feed yet.",
        priceInteger: null,
        precision: 6,
        priceDisplay: null,
        createdAtMs: null,
        expiresAtMs: null,
      }),
    };
  }
}

function parseLatestMatch(matches) {
  const candidates = normalizeMatches(matches)
    .map((match) => parseMatch(match))
    .filter(Boolean)
    .sort((left, right) => {
      const leftTime = left.createdAtMs ?? 0;
      const rightTime = right.createdAtMs ?? 0;
      return rightTime - leftTime;
    });

  return candidates[0] ?? null;
}

function normalizeMatches(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.matches)) {
    return payload.matches;
  }

  return [];
}

function parseMatch(match) {
  const datum = match?.datum ?? match?.resolved_datum ?? match?.datum_value;
  const priceMap = findFirstPriceMap(datum);

  if (!priceMap || !Number.isFinite(priceMap[0])) {
    return null;
  }

  const precision = Number.isFinite(priceMap[3]) ? priceMap[3] : 6;
  const priceDisplay = priceMap[0] / 10 ** precision;

  return {
    matchCount: 1,
    priceInteger: priceMap[0],
    precision,
    priceDisplay,
    createdAtMs: numberOrNull(priceMap[1]),
    expiresAtMs: numberOrNull(priceMap[2]),
    baseSymbol: toDisplayText(priceMap[6]),
    quoteSymbol: toDisplayText(priceMap[7]),
    baseName: toDisplayText(priceMap[8]),
    quoteName: toDisplayText(priceMap[9]),
    transactionId: match?.transaction_id ?? null,
    outputIndex: match?.output_index ?? null,
  };
}

function findFirstPriceMap(node) {
  if (!node || typeof node !== "object") {
    return null;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findFirstPriceMap(item);
      if (found) {
        return found;
      }
    }

    return null;
  }

  if (Array.isArray(node.map)) {
    const priceMap = Object.fromEntries(
      node.map
        .map((entry) => [parsePlutusScalar(entry.k), parsePlutusScalar(entry.v)])
        .filter(([key]) => Number.isInteger(key)),
    );

    if (Object.hasOwn(priceMap, 0)) {
      return priceMap;
    }
  }

  if (Array.isArray(node.fields)) {
    for (const field of node.fields) {
      const found = findFirstPriceMap(field);
      if (found) {
        return found;
      }
    }
  }

  if (Array.isArray(node.list)) {
    for (const field of node.list) {
      const found = findFirstPriceMap(field);
      if (found) {
        return found;
      }
    }
  }

  for (const value of Object.values(node)) {
    if (value && typeof value === "object") {
      const found = findFirstPriceMap(value);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

function parsePlutusScalar(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "object") {
    return null;
  }

  if (Object.hasOwn(value, "int")) {
    return Number(value.int);
  }

  if (Object.hasOwn(value, "string")) {
    return value.string;
  }

  if (Object.hasOwn(value, "bytes")) {
    return decodeBytes(value.bytes) ?? value.bytes;
  }

  if (Array.isArray(value.fields)) {
    return value.fields.map(parsePlutusScalar);
  }

  if (Array.isArray(value.list)) {
    return value.list.map(parsePlutusScalar);
  }

  return null;
}

function decodeBytes(value) {
  if (typeof value !== "string" || value.length % 2 !== 0 || !/^[0-9a-f]+$/iu.test(value)) {
    return null;
  }

  try {
    const decoded = Buffer.from(value, "hex").toString("utf8").replace(/\0/g, "");
    return /[\u0000-\u001f]/u.test(decoded) ? null : decoded;
  } catch {
    return null;
  }
}

function numberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function toDisplayText(value) {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return null;
}

