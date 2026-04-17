import { getAdaUsdQuote } from "./ada-usd-quote.mjs";
import {
  DEFAULT_MARKET_ID,
  getMarketDefinition,
  listMarketOptions,
  POLL_INTERVAL_MS,
} from "./market-catalog.mjs";

const PRICE_API_BASE_URL = "https://api.charli3.io/api/v1";

export async function getMarketQuote(requestedMarketId, options = {}) {
  const apiKey = options.apiKey ?? process.env.CHARLI3_API_KEY ?? null;
  const requestedDefinition = getMarketDefinition(requestedMarketId);
  const fallbackTrail = [];
  const visited = new Set();

  let activeDefinition = requestedDefinition;

  while (activeDefinition && !visited.has(activeDefinition.id)) {
    visited.add(activeDefinition.id);

    const quote = await loadQuoteForDefinition(activeDefinition, apiKey);

    if (quote && isRenderableQuote(activeDefinition, quote.price)) {
      return finalizeQuote({
        quote,
        requestedDefinition,
        fallbackTrail,
      });
    }

    fallbackTrail.push({
      marketId: activeDefinition.id,
      market: activeDefinition.displayName,
      reason:
        quote?.note ??
        `${activeDefinition.displayName} did not return a renderable quote.`,
    });

    activeDefinition = activeDefinition.fallbackMarketId
      ? getMarketDefinition(activeDefinition.fallbackMarketId)
      : null;
  }

  if (requestedDefinition.id !== DEFAULT_MARKET_ID) {
    const lastChance = await loadQuoteForDefinition(
      getMarketDefinition(DEFAULT_MARKET_ID),
      apiKey,
    );

    if (lastChance && Number.isFinite(lastChance.price)) {
      return finalizeQuote({
        quote: lastChance,
        requestedDefinition,
        fallbackTrail,
      });
    }
  }

  return null;
}

export function listSupportedMarkets() {
  return listMarketOptions();
}

async function loadQuoteForDefinition(definition, apiKey) {
  if (definition.quoteKind === "price-api") {
    return loadTokenApiQuote(definition, apiKey);
  }

  if (definition.quoteKind === "pull-oracle") {
    const oracleQuote = await getAdaUsdQuote();

    if (!oracleQuote) {
      return null;
    }

    return {
      marketId: definition.id,
      market: definition.displayName,
      pair: definition.pair,
      baseAsset: definition.baseAsset,
      quoteAsset: definition.quoteAsset,
      price: Number(oracleQuote.price),
      precision: Number.isFinite(oracleQuote.precision)
        ? oracleQuote.precision
        : 6,
      readiness: oracleQuote.readiness,
      source: oracleQuote.source ?? definition.routeLabel,
      routeLabel: definition.routeLabel,
      note: oracleQuote.note ?? definition.note,
      fetchedAtMs: Number(oracleQuote.fetchedAtMs ?? Date.now()),
      oracleTimestampMs: Number(oracleQuote.oracleTimestampMs ?? 0) || null,
      expiresAtMs: Number(oracleQuote.expiresAtMs ?? 0) || null,
      hourlyChangePct: null,
      dailyChangePct: null,
      currentTvl: null,
      hourlyVolume: null,
      mode:
        oracleQuote.mode === "live"
          ? "live-pull-oracle"
          : "oracle-fallback",
      requestedPoolId: null,
    };
  }

  return null;
}

async function loadTokenApiQuote(definition, apiKey) {
  if (!apiKey) {
    return {
      marketId: definition.id,
      market: definition.displayName,
      pair: definition.pair,
      baseAsset: definition.baseAsset,
      quoteAsset: definition.quoteAsset,
      price: null,
      precision: 6,
      readiness: "config-only",
      source: definition.routeLabel,
      routeLabel: definition.routeLabel,
      note: "CHARLI3_API_KEY is not available to the runtime, so this route cannot hydrate a live current price.",
      fetchedAtMs: Date.now(),
      oracleTimestampMs: null,
      expiresAtMs: null,
      hourlyChangePct: null,
      dailyChangePct: null,
      currentTvl: null,
      hourlyVolume: null,
      mode: "config-only",
      requestedPoolId: definition.currentPoolId,
    };
  }

  const endpoint = new URL(`${PRICE_API_BASE_URL}/tokens/current`);
  endpoint.searchParams.set("pool", definition.currentPoolId);

  try {
    const response = await fetch(endpoint, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(4500),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Charli3 current quote failed with ${response.status}${detail ? `: ${detail}` : ""}`,
      );
    }

    const payload = await response.json();
    const price = Number(payload.current_price);

    return {
      marketId: definition.id,
      market: definition.displayName,
      pair: definition.pair,
      baseAsset: definition.baseAsset,
      quoteAsset: definition.quoteAsset,
      price,
      precision: inferPrecision(price),
      readiness: "live",
      source: definition.routeLabel,
      routeLabel: definition.routeLabel,
      note: definition.note,
      fetchedAtMs: Date.now(),
      oracleTimestampMs: null,
      expiresAtMs: null,
      hourlyChangePct: numberOrNull(payload.hourly_price_change),
      dailyChangePct: numberOrNull(payload.daily_price_change),
      currentTvl: numberOrNull(payload.current_tvl),
      hourlyVolume: numberOrNull(payload.hourly_volume),
      mode: "live-price-api",
      requestedPoolId: definition.currentPoolId,
    };
  } catch (error) {
    return {
      marketId: definition.id,
      market: definition.displayName,
      pair: definition.pair,
      baseAsset: definition.baseAsset,
      quoteAsset: definition.quoteAsset,
      price: null,
      precision: 6,
      readiness: "config-only",
      source: definition.routeLabel,
      routeLabel: definition.routeLabel,
      note: error.message,
      fetchedAtMs: Date.now(),
      oracleTimestampMs: null,
      expiresAtMs: null,
      hourlyChangePct: null,
      dailyChangePct: null,
      currentTvl: null,
      hourlyVolume: null,
      mode: "config-only",
      requestedPoolId: definition.currentPoolId,
    };
  }
}

function finalizeQuote({ quote, requestedDefinition, fallbackTrail }) {
  const fallbackApplied = quote.marketId !== requestedDefinition.id;
  const fallbackNote = buildFallbackNote({
    requestedDefinition,
    resolvedMarket: quote.market,
    fallbackTrail,
    fallbackApplied,
  });

  return {
    ...quote,
    requestedMarketId: requestedDefinition.id,
    requestedMarket: requestedDefinition.displayName,
    fallbackApplied,
    fallbackTrail,
    fallbackNote,
    pollIntervalMs: POLL_INTERVAL_MS,
  };
}

function buildFallbackNote({
  requestedDefinition,
  resolvedMarket,
  fallbackTrail,
  fallbackApplied,
}) {
  if (!fallbackApplied) {
    return `${resolvedMarket} is the active live route.`;
  }

  const firstReason = fallbackTrail[0]?.reason ?? "The requested market was unavailable.";
  return `${requestedDefinition.displayName} was too thin or unavailable for a clean live board, so the route fell back to ${resolvedMarket}. ${firstReason}`;
}

function isRenderableQuote(definition, price) {
  return (
    Number.isFinite(price) &&
    Math.abs(price) >= (definition.minimumRenderablePrice ?? 0)
  );
}

function inferPrecision(price) {
  const absolute = Math.abs(price);

  if (!Number.isFinite(absolute) || absolute === 0) {
    return 6;
  }

  if (absolute >= 100) {
    return 2;
  }

  if (absolute >= 1) {
    return 4;
  }

  if (absolute >= 0.01) {
    return 6;
  }

  if (absolute >= 0.0001) {
    return 8;
  }

  return 10;
}

function numberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}
