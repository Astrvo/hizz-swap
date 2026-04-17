const state = {
  history: [],
  latestQuote: null,
  selectedLevel: 1,
  runtimeMode: "booting",
  staticDataset: null,
  polling: false,
};

const LEVELS = [1, 2, 3, 4];
const MAX_POINTS = 72;
const FALLBACK_PRICE = 0.334136;

const refs = {
  statusMode: document.querySelector("#statusMode"),
  statusText: document.querySelector("#statusText"),
  currentPrice: document.querySelector("#currentPrice"),
  priceSubline: document.querySelector("#priceSubline"),
  marketName: document.querySelector("#marketName"),
  readinessBadge: document.querySelector("#readinessBadge"),
  sourceLabel: document.querySelector("#sourceLabel"),
  lastPullLabel: document.querySelector("#lastPullLabel"),
  currentLine: document.querySelector("#currentLine"),
  currentTag: document.querySelector("#currentTag"),
  chartLine: document.querySelector("#chartLine"),
  chartFill: document.querySelector("#chartFill"),
  projectionLayer: document.querySelector("#projectionLayer"),
  selectionSummary: document.querySelector("#selectionSummary"),
  oracleNote: document.querySelector("#oracleNote"),
  endpointLabel: document.querySelector("#endpointLabel"),
};

boot();

async function boot() {
  bindInteractions();
  await refreshQuote(true);
  window.setInterval(() => {
    refreshQuote(false);
  }, 1000);
}

function bindInteractions() {
  refs.projectionLayer.addEventListener("click", (event) => {
    const tile = event.target.closest("[data-level]");
    if (!tile) {
      return;
    }

    state.selectedLevel = Number(tile.dataset.level);
    render();
  });
}

async function refreshQuote(isBoot) {
  if (state.polling) {
    return;
  }

  state.polling = true;

  try {
    const quote = await fetchAdaQuote();
    if (!quote) {
      return;
    }

    state.latestQuote = quote;

    if (!state.history.length) {
      seedHistory(quote.price, quote.fetchedAtMs);
    } else {
      appendHistory(quote.price, quote.fetchedAtMs);
    }

    if (isBoot && !LEVELS.includes(Math.abs(state.selectedLevel))) {
      state.selectedLevel = 1;
    }

    render();
  } finally {
    state.polling = false;
  }
}

async function fetchAdaQuote() {
  const apiPayload = await tryFetchJson("/api/ada-usd");
  if (apiPayload?.data) {
    state.runtimeMode = "live-api";
    return normalizeQuote(apiPayload.data);
  }

  const staticBundle = await getStaticBundle();
  const view = staticBundle?.views?.["ada-usd-preprod"];
  if (!view) {
    return null;
  }

  state.runtimeMode = "static-demo";
  return normalizeQuote({
    market: view.displayName,
    pair: view.pair,
    baseAsset: view.baseAsset,
    quoteAsset: view.quoteAsset,
    price: view.oracle.priceDisplay,
    precision: view.oracle.precision,
    readiness: view.oracle.readiness,
    source: view.oracle.source,
    note: view.oracle.note,
    fetchedAtMs: Date.now(),
    oracleTimestampMs: view.oracle.createdAtMs,
    expiresAtMs: view.oracle.expiresAtMs,
    mode: "static-demo",
    kupoEndpoint: view.networkConfig.kupoUrl,
  });
}

function normalizeQuote(raw) {
  const price = Number(raw.price ?? FALLBACK_PRICE);

  return {
    market: raw.market ?? "ADA / USD",
    pair: raw.pair ?? "ADA/USD",
    baseAsset: raw.baseAsset ?? "ADA",
    quoteAsset: raw.quoteAsset ?? "USD",
    price: Number.isFinite(price) ? price : FALLBACK_PRICE,
    precision: Number.isFinite(raw.precision) ? raw.precision : 6,
    readiness: raw.readiness ?? "seeded",
    source: raw.source ?? "charli3",
    note: raw.note ?? "",
    fetchedAtMs: Number(raw.fetchedAtMs ?? Date.now()),
    oracleTimestampMs: raw.oracleTimestampMs ? Number(raw.oracleTimestampMs) : null,
    expiresAtMs: raw.expiresAtMs ? Number(raw.expiresAtMs) : null,
    mode: raw.mode ?? state.runtimeMode,
    kupoEndpoint: raw.kupoEndpoint ?? "/api/ada-usd",
  };
}

async function getStaticBundle() {
  if (state.staticDataset) {
    return state.staticDataset;
  }

  const response = await fetch("/data/oracles.json", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Static data bundle unavailable (${response.status})`);
  }

  state.staticDataset = await response.json();
  return state.staticDataset;
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

function seedHistory(price, fetchedAtMs) {
  state.history = Array.from({ length: MAX_POINTS }, (_, index) => ({
    price,
    timestamp: fetchedAtMs - (MAX_POINTS - index) * 1000,
  }));
}

function appendHistory(price, fetchedAtMs) {
  state.history.push({
    price,
    timestamp: fetchedAtMs,
  });

  if (state.history.length > MAX_POINTS) {
    state.history = state.history.slice(-MAX_POINTS);
  }
}

function render() {
  if (!state.latestQuote) {
    return;
  }

  const quote = state.latestQuote;
  const chartModel = buildChartModel(state.history);
  const projections = buildProjectionModel({
    price: quote.price,
    chartModel,
    trendBias: computeTrendBias(state.history),
  });
  const selectedProjection =
    projections.find((projection) => projection.level === state.selectedLevel) ?? projections[0];

  refs.marketName.textContent = quote.market;
  refs.currentPrice.textContent = formatPrice(quote.price);
  refs.priceSubline.textContent = buildPriceSubline(chartModel, quote);
  refs.readinessBadge.textContent = quote.readiness;
  refs.sourceLabel.textContent = quote.source;
  refs.lastPullLabel.textContent = formatTime(quote.fetchedAtMs);
  refs.oracleNote.textContent = quote.note;
  refs.endpointLabel.textContent =
    state.runtimeMode === "live-api" ? "/api/ada-usd" : "static oracle bundle";
  refs.statusMode.textContent = state.runtimeMode === "live-api" ? "Live API mode" : "Static demo mode";
  refs.statusText.textContent =
    state.runtimeMode === "live-api"
      ? "Polling the ADA/USD oracle route every second."
      : "Polling the static ADA/USD fallback every second.";
  refs.currentLine.style.top = `${chartModel.currentY}%`;
  refs.currentTag.style.top = `calc(${chartModel.currentY}% - 1.2rem)`;
  refs.currentTag.textContent = formatPrice(quote.price);
  refs.chartLine.setAttribute("d", chartModel.linePath);
  refs.chartFill.setAttribute("d", chartModel.fillPath);
  refs.chartFill.setAttribute("fill", "url(#chartGradient)");
  refs.projectionLayer.innerHTML = projections
    .map((projection) => renderProjectionTile(projection, selectedProjection.level))
    .join("");
  refs.selectionSummary.textContent = buildSelectionSummary(selectedProjection);
}

function buildChartModel(history) {
  const prices = history.map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || max * 0.012 || 0.01;
  const paddedMin = min - span * 1.8;
  const paddedMax = max + span * 1.8;
  const width = 1200;
  const height = 560;

  const points = history.map((point, index) => {
    const x = (index / Math.max(1, history.length - 1)) * width;
    const y = scaleY(point.price, paddedMin, paddedMax, height);
    return { x, y, price: point.price };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const fillPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  const currentY = ((points.at(-1)?.y ?? height / 2) / height) * 100;

  return {
    paddedMin,
    paddedMax,
    linePath,
    fillPath,
    currentY,
    width,
    height,
    latest: points.at(-1)?.price ?? FALLBACK_PRICE,
    previous: points.at(-2)?.price ?? points.at(-1)?.price ?? FALLBACK_PRICE,
  };
}

function buildProjectionModel({ price, chartModel, trendBias }) {
  const tiles = [];

  for (const level of LEVELS) {
    const movePct = 0.0034 + (level - 1) * 0.0048;
    const leverage = 2 + level * 2 + (level > 2 ? 1 : 0);

    for (const direction of [1, -1]) {
      const signedLevel = level * direction;
      const target = price * (1 + movePct * direction);
      const odds = clamp(
        Math.round(56 - level * 10 + trendBias * 18 * direction),
        8,
        72,
      );
      const x = 48 + level * 10.5;
      const y = ((scaleY(target, chartModel.paddedMin, chartModel.paddedMax, chartModel.height) / chartModel.height) * 100);
      tiles.push({
        level: signedLevel,
        direction: direction > 0 ? "up" : "down",
        target,
        odds,
        leverage,
        left: x,
        top: y,
      });
    }
  }

  return tiles.sort((left, right) => left.left - right.left || left.top - right.top);
}

function renderProjectionTile(projection, activeLevel) {
  const activeClass = projection.level === activeLevel ? "active" : "";
  const directionLabel = projection.direction === "up" ? "Upper target" : "Lower target";
  const moveLabel = projection.direction === "up" ? "Rise" : "Dip";

  return `
    <button
      class="projection-tile ${projection.direction} ${activeClass}"
      data-level="${projection.level}"
      style="left:${projection.left}%; top:calc(${projection.top}% - 3rem);"
      aria-label="${directionLabel} ${formatPrice(projection.target)}"
    >
      <span class="projection-direction">${moveLabel}</span>
      <strong class="projection-target">${formatPrice(projection.target)}</strong>
      <span class="projection-odds">${projection.odds}% odds</span>
      <span class="projection-lev"><strong>x${projection.leverage}</strong> leverage</span>
    </button>
  `;
}

function buildSelectionSummary(projection) {
  const directionLabel = projection.direction === "up" ? "upside" : "downside";
  return `Target ${formatPrice(projection.target)} on the ${directionLabel} ladder with ${projection.odds}% implied odds and x${projection.leverage} leverage.`;
}

function buildPriceSubline(chartModel, quote) {
  const delta = quote.price - chartModel.previous;
  const deltaPct = chartModel.previous === 0 ? 0 : (delta / chartModel.previous) * 100;
  const sign = delta >= 0 ? "+" : "";
  const modeLabel = quote.readiness === "live" ? "Live pull" : "Oracle fallback";
  return `${modeLabel} ${sign}${deltaPct.toFixed(2)}% in the current 1s tick.`;
}

function computeTrendBias(history) {
  if (history.length < 8) {
    return 0;
  }

  const recent = history.slice(-8);
  const first = recent[0]?.price ?? FALLBACK_PRICE;
  const last = recent.at(-1)?.price ?? FALLBACK_PRICE;
  return clamp((last - first) / Math.max(first, 0.000001), -1, 1);
}

function scaleY(value, min, max, height) {
  const ratio = (value - min) / Math.max(max - min, 0.000001);
  return height - ratio * height;
}

function formatPrice(value) {
  return `${Number(value).toFixed(6)} USD`;
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
