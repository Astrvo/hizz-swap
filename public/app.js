const POLL_INTERVAL_MS = 2000;
const MAX_POINTS = 180;
const STORAGE_KEY = "hizz-swap-live-history-v2";
const HISTORY_TTL_MS = 1000 * 60 * 20;
const DEFAULT_MARKET_ID = "midnight-ada";
const FALLBACK_PRICE = 0.334136;

const state = {
  historyByMarket: loadStoredHistory(),
  latestQuote: null,
  selectedMarketId: DEFAULT_MARKET_ID,
  selectedTradeId: null,
  runtimeMode: "booting",
  polling: false,
};

const refs = {
  marketSelect: document.querySelector("#marketSelect"),
  statusMode: document.querySelector("#statusMode"),
  statusText: document.querySelector("#statusText"),
  marketName: document.querySelector("#marketName"),
  readinessBadge: document.querySelector("#readinessBadge"),
  currentPrice: document.querySelector("#currentPrice"),
  priceSubline: document.querySelector("#priceSubline"),
  sourceLabel: document.querySelector("#sourceLabel"),
  lastPullLabel: document.querySelector("#lastPullLabel"),
  sampleCountLabel: document.querySelector("#sampleCountLabel"),
  currentLine: document.querySelector("#currentLine"),
  currentTag: document.querySelector("#currentTag"),
  centerTag: document.querySelector("#centerTag"),
  chartLine: document.querySelector("#chartLine"),
  chartFill: document.querySelector("#chartFill"),
  routingNote: document.querySelector("#routingNote"),
  oracleNote: document.querySelector("#oracleNote"),
  endpointLabel: document.querySelector("#endpointLabel"),
  centerPrice: document.querySelector("#centerPrice"),
  selectionSummary: document.querySelector("#selectionSummary"),
  tradeBoard: document.querySelector("#tradeBoard"),
};

boot();

async function boot() {
  bindInteractions();
  await refreshQuote(true);

  window.setInterval(() => {
    refreshQuote(false);
  }, POLL_INTERVAL_MS);
}

function bindInteractions() {
  refs.marketSelect.addEventListener("change", async (event) => {
    state.selectedMarketId = event.target.value;
    state.selectedTradeId = null;
    await refreshQuote(true);
  });

  refs.tradeBoard.addEventListener("click", (event) => {
    const tile = event.target.closest("[data-trade-id]");

    if (!tile) {
      return;
    }

    state.selectedTradeId = tile.dataset.tradeId;
    render();
  });
}

async function refreshQuote(isBoot) {
  if (state.polling) {
    return;
  }

  state.polling = true;

  try {
    const quote = await fetchMarketQuote(state.selectedMarketId);

    if (!quote) {
      return;
    }

    state.latestQuote = quote;
    state.runtimeMode = quote.mode;
    appendHistory(quote.marketId, quote.price, quote.fetchedAtMs);

    if (isBoot || !state.selectedTradeId) {
      state.selectedTradeId = "up-1";
    }

    persistHistory();
    render();
  } finally {
    state.polling = false;
  }
}

async function fetchMarketQuote(marketId) {
  const apiPayload = await tryFetchJson(`/api/quote?market=${encodeURIComponent(marketId)}`);

  if (apiPayload?.data) {
    return normalizeQuote(apiPayload.data);
  }

  const legacyAdaPayload = await tryFetchJson("/api/ada-usd");

  if (legacyAdaPayload?.data) {
    return normalizeQuote({
      ...legacyAdaPayload.data,
      marketId: "ada-usd",
      requestedMarketId: marketId,
      requestedMarket: labelForMarket(marketId),
      fallbackApplied: marketId !== "ada-usd",
      fallbackNote:
        marketId !== "ada-usd"
          ? `${labelForMarket(marketId)} is unavailable right now, so the board fell back to ADA / USD.`
          : "ADA / USD is the active route.",
      pollIntervalMs: POLL_INTERVAL_MS,
      routeLabel: legacyAdaPayload.data.source,
      mode: legacyAdaPayload.data.mode === "live" ? "live-pull-oracle" : "oracle-fallback",
    });
  }

  return normalizeQuote({
    marketId: "ada-usd",
    requestedMarketId: marketId,
    requestedMarket: labelForMarket(marketId),
    market: "ADA / USD",
    pair: "ADA/USD",
    baseAsset: "ADA",
    quoteAsset: "USD",
    price: FALLBACK_PRICE,
    precision: 6,
    readiness: "static-demo",
    source: "static demo fallback",
    routeLabel: "Static demo fallback",
    note: "Live function data is unavailable, so the UI is using the bundled fallback quote.",
    fetchedAtMs: Date.now(),
    oracleTimestampMs: null,
    expiresAtMs: null,
    hourlyChangePct: null,
    dailyChangePct: null,
    currentTvl: null,
    hourlyVolume: null,
    mode: "static-demo",
    fallbackApplied: marketId !== "ada-usd",
    fallbackNote: `${labelForMarket(marketId)} is unavailable right now, so the board is showing a static ADA / USD fallback.`,
    pollIntervalMs: POLL_INTERVAL_MS,
  });
}

function normalizeQuote(raw) {
  const price = Number(raw.price ?? FALLBACK_PRICE);

  return {
    marketId: raw.marketId ?? "ada-usd",
    requestedMarketId: raw.requestedMarketId ?? raw.marketId ?? "ada-usd",
    requestedMarket: raw.requestedMarket ?? raw.market ?? "ADA / USD",
    market: raw.market ?? "ADA / USD",
    pair: raw.pair ?? "ADA/USD",
    baseAsset: raw.baseAsset ?? "ADA",
    quoteAsset: raw.quoteAsset ?? "USD",
    price: Number.isFinite(price) ? price : FALLBACK_PRICE,
    precision: Number.isFinite(raw.precision) ? raw.precision : 6,
    readiness: raw.readiness ?? "live",
    source: raw.source ?? raw.routeLabel ?? "charli3",
    routeLabel: raw.routeLabel ?? raw.source ?? "charli3",
    note: raw.note ?? "",
    fallbackApplied: Boolean(raw.fallbackApplied),
    fallbackNote: raw.fallbackNote ?? `${raw.market ?? "Selected market"} is the active route.`,
    fetchedAtMs: Number(raw.fetchedAtMs ?? Date.now()),
    oracleTimestampMs: numberOrNull(raw.oracleTimestampMs),
    expiresAtMs: numberOrNull(raw.expiresAtMs),
    hourlyChangePct: numberOrNull(raw.hourlyChangePct),
    dailyChangePct: numberOrNull(raw.dailyChangePct),
    currentTvl: numberOrNull(raw.currentTvl),
    hourlyVolume: numberOrNull(raw.hourlyVolume),
    mode: raw.mode ?? "live-price-api",
    pollIntervalMs: Number(raw.pollIntervalMs ?? POLL_INTERVAL_MS),
  };
}

async function tryFetchJson(url) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

function appendHistory(marketId, price, timestamp) {
  const current = state.historyByMarket[marketId] ?? [];
  const next = [
    ...current,
    {
      price,
      timestamp,
    },
  ]
    .filter((point) => timestamp - point.timestamp <= HISTORY_TTL_MS)
    .slice(-MAX_POINTS);

  state.historyByMarket[marketId] = next;
}

function render() {
  if (!state.latestQuote) {
    return;
  }

  const quote = state.latestQuote;
  const rawHistory = state.historyByMarket[quote.marketId] ?? [];
  const visibleHistory = compressHistory(rawHistory, quote);
  const chartModel = buildChartModel(visibleHistory, quote);
  const tradeModel = buildTradeModel(quote, rawHistory);
  const activeTrade =
    tradeModel.find((trade) => trade.id === state.selectedTradeId) ?? tradeModel[0];

  refs.marketSelect.value = state.selectedMarketId;
  refs.marketName.textContent = quote.market;
  refs.readinessBadge.textContent = quote.readiness;
  refs.currentPrice.textContent = formatPrice(quote.price, quote.quoteAsset);
  refs.priceSubline.textContent = buildPriceSubline({
    quote,
    history: rawHistory,
  });
  refs.sourceLabel.textContent = quote.routeLabel;
  refs.lastPullLabel.textContent = formatTime(quote.fetchedAtMs);
  refs.sampleCountLabel.textContent = `${rawHistory.length} ticks`;
  refs.routingNote.textContent = quote.fallbackNote;
  refs.oracleNote.textContent = quote.note;
  refs.endpointLabel.textContent = `/api/quote?market=${quote.requestedMarketId}`;
  refs.statusMode.textContent = buildModeLabel(quote.mode);
  refs.statusText.textContent = buildStatusText(quote);
  refs.centerPrice.textContent = formatPrice(quote.price, quote.quoteAsset);
  refs.currentLine.style.top = `${chartModel.currentY}%`;
  refs.currentTag.style.top = `calc(${chartModel.currentY}% - 1.2rem)`;
  refs.currentTag.textContent = formatPrice(quote.price, quote.quoteAsset);
  refs.centerTag.textContent = formatPrice(quote.price, quote.quoteAsset);
  refs.chartLine.setAttribute("d", chartModel.linePath);
  refs.chartFill.setAttribute("d", chartModel.fillPath);
  refs.tradeBoard.innerHTML = renderTradeBoard(tradeModel, activeTrade, quote);
  refs.selectionSummary.textContent = buildSelectionSummary(activeTrade, quote);
}

function compressHistory(history, quote) {
  if (!history.length) {
    return [
      {
        price: quote.price,
        timestamp: quote.fetchedAtMs,
      },
    ];
  }

  const epsilon = Math.max(Math.abs(quote.price) * 0.00002, 1 / 10 ** Math.max(quote.precision, 6));
  const compact = history.reduce((accumulator, point) => {
    const previous = accumulator.at(-1);

    if (!previous || Math.abs(previous.price - point.price) > epsilon) {
      accumulator.push(point);
      return accumulator;
    }

    accumulator[accumulator.length - 1] = point;
    return accumulator;
  }, []);

  if (compact.length === 1 && history.length > 1) {
    return [history[0], history.at(-1)];
  }

  return compact;
}

function buildChartModel(history, quote) {
  const width = 1200;
  const height = 640;
  const safeHistory = history.length
    ? history
    : [
        {
          price: quote.price,
          timestamp: quote.fetchedAtMs,
        },
      ];
  const latest = safeHistory.at(-1)?.price ?? quote.price;
  const maxOffset = Math.max(
    ...safeHistory.map((point) => Math.abs(point.price - latest)),
    0,
  );
  const percentageFloor =
    Math.abs(latest) >= 1 ? Math.abs(latest) * 0.012 : Math.abs(latest) * 0.04;
  const minimumSpan = Math.max(percentageFloor, 1 / 10 ** Math.max(quote.precision - 1, 4));
  const radius = Math.max(maxOffset * 2.1, minimumSpan, 0.000001);
  const paddedMin = latest - radius;
  const paddedMax = latest + radius;
  const points = (safeHistory.length === 1
    ? [
        safeHistory[0],
        {
          price: safeHistory[0].price,
          timestamp: safeHistory[0].timestamp + quote.pollIntervalMs,
        },
      ]
    : safeHistory
  ).map((point, index, collection) => ({
    x: (index / Math.max(1, collection.length - 1)) * width,
    y: scaleY(point.price, paddedMin, paddedMax, height),
    price: point.price,
  }));

  const linePath = buildSmoothPath(points);
  const fillPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return {
    linePath,
    fillPath,
    currentY: 50,
  };
}

function buildTradeModel(quote, history) {
  const baseMovePct = computeBaseMovePct(history, quote.price);
  const trendBias = computeTrendBias(history);
  const ladder = [];

  for (const direction of [1, -1]) {
    for (const level of [1, 2, 3]) {
      const movePct = baseMovePct * (1 + (level - 1) * 0.9);
      const leverage = clamp(Math.round(2 + level * 2.5 + Math.abs(trendBias) * 2), 2, 12);
      const odds = clamp(
        Math.round(64 - level * 11 + trendBias * 10 * direction),
        8,
        84,
      );
      const target = quote.price * (1 + movePct * direction);

      ladder.push({
        id: `${direction > 0 ? "up" : "down"}-${level}`,
        direction: direction > 0 ? "up" : "down",
        level,
        target,
        movePct,
        leverage,
        odds,
      });
    }
  }

  return ladder;
}

function renderTradeBoard(trades, activeTrade, quote) {
  const longs = trades.filter((trade) => trade.direction === "up");
  const shorts = trades.filter((trade) => trade.direction === "down");

  return `
    <section class="trade-group">
      <span class="trade-group-title">Above spot</span>
      ${longs.map((trade) => renderTradeCard(trade, activeTrade, quote)).join("")}
    </section>
    <section class="trade-spot">
      <span class="trade-group-title">Center price</span>
      <strong>${formatPrice(quote.price, quote.quoteAsset)}</strong>
      <span class="trade-copy">${quote.market} recalculated every ${formatPollingWindow(quote.pollIntervalMs)}.</span>
    </section>
    <section class="trade-group">
      <span class="trade-group-title">Below spot</span>
      ${shorts.map((trade) => renderTradeCard(trade, activeTrade, quote)).join("")}
    </section>
  `;
}

function renderTradeCard(trade, activeTrade, quote) {
  const activeClass = activeTrade?.id === trade.id ? "active" : "";
  const sideLabel = trade.direction === "up" ? "Long ladder" : "Short ladder";
  const moveLabel = `${trade.direction === "up" ? "+" : "-"}${(trade.movePct * 100).toFixed(2)}%`;

  return `
    <button
      class="trade-card ${trade.direction} ${activeClass}"
      data-trade-id="${trade.id}"
      aria-label="${sideLabel} target ${formatPrice(trade.target, quote.quoteAsset)}"
    >
      <span class="trade-card-side">${sideLabel}</span>
      <strong class="trade-card-target">${formatPrice(trade.target, quote.quoteAsset)}</strong>
      <div class="trade-card-meta">
        <span>${moveLabel}</span>
        <span>x${trade.leverage} leverage</span>
      </div>
      <span class="trade-card-odds">${trade.odds}% implied odds</span>
    </button>
  `;
}

function buildSelectionSummary(trade, quote) {
  const directionLabel = trade.direction === "up" ? "push higher" : "push lower";
  return `${quote.market} would need a ${directionLabel} move to ${formatPrice(
    trade.target,
    quote.quoteAsset,
  )}. This ladder implies ${trade.odds}% odds with x${trade.leverage} leverage.`;
}

function buildPriceSubline({ quote, history }) {
  const previous = history.at(-2)?.price ?? quote.price;
  const delta = quote.price - previous;
  const epsilon = Math.max(Math.abs(quote.price) * 0.00001, 1 / 10 ** Math.max(quote.precision, 6));

  if (Math.abs(delta) > epsilon) {
    const deltaPct = previous === 0 ? 0 : (delta / previous) * 100;
    return `Fresh ${formatPollingWindow(quote.pollIntervalMs)} print ${formatSignedPercent(deltaPct)} from the previous sample.`;
  }

  if (Number.isFinite(quote.hourlyChangePct)) {
    return `Waiting for the next live print. No price change arrived in the last ${formatPollingWindow(quote.pollIntervalMs)}. 1h change is ${formatSignedPercent(
      quote.hourlyChangePct,
    )}.`;
  }

  return `Sampling every ${formatPollingWindow(quote.pollIntervalMs)} and keeping the latest ${MAX_POINTS} real ticks in memory.`;
}

function buildModeLabel(mode) {
  if (mode === "live-price-api") {
    return "Live price API";
  }

  if (mode === "live-pull-oracle") {
    return "Live oracle";
  }

  if (mode === "oracle-fallback") {
    return "Oracle fallback";
  }

  return "Static demo";
}

function buildStatusText(quote) {
  if (quote.mode === "live-price-api") {
    return `Polling ${quote.routeLabel} every ${formatPollingWindow(quote.pollIntervalMs)}.`;
  }

  if (quote.mode === "live-pull-oracle") {
    return "Token API fallback was skipped, so the board is sampling the pull oracle route.";
  }

  if (quote.mode === "oracle-fallback") {
    return "Live token-pair routing is unavailable, so the board fell back to the oracle route.";
  }

  return "Function data is unavailable, so the board is rendering the static fallback.";
}

function computeBaseMovePct(history, price) {
  if (history.length < 4) {
    return price >= 0.1 ? 0.004 : 0.008;
  }

  const recent = history.slice(-24);
  const returns = [];

  for (let index = 1; index < recent.length; index += 1) {
    const previous = recent[index - 1].price;
    const current = recent[index].price;

    if (!previous || !current) {
      continue;
    }

    returns.push(Math.abs((current - previous) / previous));
  }

  const averageReturn =
    returns.reduce((sum, value) => sum + value, 0) / Math.max(returns.length, 1);

  return clamp(
    Math.max(averageReturn * 2.8, price >= 0.1 ? 0.004 : 0.008),
    0.003,
    0.12,
  );
}

function computeTrendBias(history) {
  if (history.length < 6) {
    return 0;
  }

  const recent = history.slice(-8);
  const first = recent[0]?.price ?? recent.at(-1)?.price ?? FALLBACK_PRICE;
  const last = recent.at(-1)?.price ?? first;
  return clamp((last - first) / Math.max(Math.abs(first), 0.00000001), -1, 1);
}

function buildSmoothPath(points) {
  if (points.length < 2) {
    return "M 0 320 L 1200 320";
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const controlX = ((current.x + next.x) / 2).toFixed(2);
    path += ` Q ${controlX} ${current.y.toFixed(2)} ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }

  return path;
}

function scaleY(value, min, max, height) {
  const ratio = (value - min) / Math.max(max - min, 0.00000001);
  return height - ratio * height;
}

function formatPrice(value, quoteAsset) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  const absolute = Math.abs(value);

  if (absolute >= 100) {
    return `${value.toFixed(2)} ${quoteAsset}`;
  }

  if (absolute >= 1) {
    return `${value.toFixed(4)} ${quoteAsset}`;
  }

  if (absolute >= 0.01) {
    return `${value.toFixed(6)} ${quoteAsset}`;
  }

  if (absolute >= 0.0001) {
    return `${value.toFixed(8)} ${quoteAsset}`;
  }

  if (absolute >= 0.000001) {
    return `${value.toFixed(10)} ${quoteAsset}`;
  }

  return `${value.toExponential(4)} ${quoteAsset}`;
}

function formatSignedPercent(value) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatPollingWindow(value) {
  if (!Number.isFinite(value)) {
    return "2s";
  }

  if (value % 1000 === 0) {
    return `${value / 1000}s`;
  }

  return `${value}ms`;
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function labelForMarket(id) {
  if (id === "midnight-ada") {
    return "MIDnight / ADA";
  }

  if (id === "snek-ada") {
    return "SNEK / ADA";
  }

  return "ADA / USD";
}

function loadStoredHistory() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const now = Date.now();
    const result = {};

    for (const [marketId, points] of Object.entries(parsed)) {
      if (!Array.isArray(points)) {
        continue;
      }

      result[marketId] = points
        .map((point) => ({
          price: Number(point.price),
          timestamp: Number(point.timestamp),
        }))
        .filter(
          (point) =>
            Number.isFinite(point.price) &&
            Number.isFinite(point.timestamp) &&
            now - point.timestamp <= HISTORY_TTL_MS,
        )
        .slice(-MAX_POINTS);
    }

    return result;
  } catch {
    return {};
  }
}

function persistHistory() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.historyByMarket));
  } catch {
    // Local persistence is optional for the demo.
  }
}

function numberOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
