import { getOracleView } from "./oracle-service.mjs";

export async function getAdaUsdQuote() {
  const view = await getOracleView("ada-usd-preprod");

  if (!view) {
    return null;
  }

  const oracle = view.oracle;

  return {
    id: view.id,
    market: view.displayName,
    pair: view.pair,
    baseAsset: view.baseAsset,
    quoteAsset: view.quoteAsset,
    price: oracle.priceDisplay,
    priceInteger: oracle.priceInteger ?? null,
    precision: oracle.precision ?? 6,
    readiness: oracle.readiness,
    source: oracle.source,
    note: oracle.note,
    fetchedAtMs: oracle.fetchedAtMs ?? Date.now(),
    oracleTimestampMs: oracle.createdAtMs ?? null,
    expiresAtMs: oracle.expiresAtMs ?? null,
    kupoEndpoint: oracle.kupoEndpoint ?? null,
    oracleAddress: view.oracleAddress,
    policyId: view.policyId,
    mode: oracle.demoMode ?? (oracle.readiness === "live" ? "live" : "snapshot"),
  };
}

