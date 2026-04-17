const state = {
  cards: [],
  selectedId: "ada-usd-preprod",
  selectedOracle: null,
  amount: 42,
  streak: 3,
  risk: "calm",
  slippage: 30,
};

const riskProfiles = {
  calm: {
    label: "Calm",
    multiplier: 0.92,
    line: "Smooth onboarding mode for first-time tappers.",
  },
  balanced: {
    label: "Balanced",
    multiplier: 1.18,
    line: "Default mode for routing with mild spectacle.",
  },
  turbo: {
    label: "Turbo",
    multiplier: 1.5,
    line: "Highest dopamine, biggest tolerance for route drama.",
  },
};

const refs = {
  amountInput: document.querySelector("#amountInput"),
  amountLabel: document.querySelector("#amountLabel"),
  streakInput: document.querySelector("#streakInput"),
  streakLabel: document.querySelector("#streakLabel"),
  marketRail: document.querySelector("#marketRail"),
  oracleTitle: document.querySelector("#oracleTitle"),
  oracleReadiness: document.querySelector("#oracleReadiness"),
  oraclePrice: document.querySelector("#oraclePrice"),
  oracleMeta: document.querySelector("#oracleMeta"),
  oracleNote: document.querySelector("#oracleNote"),
  oraclePolicy: document.querySelector("#oraclePolicy"),
  oracleAddress: document.querySelector("#oracleAddress"),
  oracleReference: document.querySelector("#oracleReference"),
  oracleWindow: document.querySelector("#oracleWindow"),
  nodeStrip: document.querySelector("#nodeStrip"),
  metricFeeds: document.querySelector("#metricFeeds"),
  riskRow: document.querySelector("#riskRow"),
  slippageRow: document.querySelector("#slippageRow"),
  questScore: document.querySelector("#questScore"),
  routeList: document.querySelector("#routeList"),
  narrative: document.querySelector("#narrative"),
  runButton: document.querySelector("#runButton"),
};

boot();

async function boot() {
  bindControls();
  await hydrateCards();
  await selectMarket(state.selectedId);
}

function bindControls() {
  refs.amountInput.addEventListener("input", () => {
    state.amount = Number(refs.amountInput.value);
    renderControls();
    renderQuest();
  });

  refs.streakInput.addEventListener("input", () => {
    state.streak = Number(refs.streakInput.value);
    renderControls();
    renderQuest();
  });

  refs.riskRow.addEventListener("click", (event) => {
    const button = event.target.closest("[data-risk]");
    if (!button) {
      return;
    }

    state.risk = button.dataset.risk;
    syncChipRow(refs.riskRow, "[data-risk]", state.risk);
    renderQuest();
  });

  refs.slippageRow.addEventListener("click", (event) => {
    const button = event.target.closest("[data-slippage]");
    if (!button) {
      return;
    }

    state.slippage = Number(button.dataset.slippage);
    syncChipRow(refs.slippageRow, "[data-slippage]", String(state.slippage));
    renderQuest();
  });

  refs.runButton.addEventListener("click", () => {
    renderQuest(true);
  });

  renderControls();
}

async function hydrateCards() {
  const response = await fetch("/api/oracles");
  const payload = await response.json();
  state.cards = payload.data ?? [];
  refs.metricFeeds.textContent = String(state.cards.length);
  renderMarketRail();
}

async function selectMarket(id) {
  state.selectedId = id;
  renderMarketRail();

  const response = await fetch(`/api/oracles/${id}`);
  const payload = await response.json();
  state.selectedOracle = payload.data;
  renderOracleDesk();
  renderQuest();
}

function renderControls() {
  refs.amountLabel.textContent = `${state.amount} ADA`;
  refs.streakLabel.textContent = `${state.streak} wins`;
  syncChipRow(refs.riskRow, "[data-risk]", state.risk);
  syncChipRow(refs.slippageRow, "[data-slippage]", String(state.slippage));
}

function syncChipRow(root, selector, activeValue) {
  root.querySelectorAll(selector).forEach((button) => {
    const nextValue = button.dataset.risk ?? button.dataset.slippage;
    button.classList.toggle("active", nextValue === activeValue);
  });
}

function renderMarketRail() {
  refs.marketRail.innerHTML = state.cards
    .map(
      (card) => `
        <article class="market-card ${card.id === state.selectedId ? "active" : ""}" data-id="${card.id}">
          <span class="card-label">${card.network}</span>
          <strong>${card.displayName}</strong>
          <span>${card.nodeCount} nodes</span>
          <span>${card.validityWindowMinutes}m validity</span>
          <div class="muted">Policy ${card.policyIdShort}</div>
        </article>
      `,
    )
    .join("");

  refs.marketRail.querySelectorAll("[data-id]").forEach((card) => {
    card.addEventListener("click", () => {
      selectMarket(card.dataset.id);
    });
  });
}

function renderOracleDesk() {
  const oracleView = state.selectedOracle;
  const oracle = oracleView.oracle;

  refs.oracleTitle.textContent = oracleView.displayName;
  refs.oracleReadiness.textContent = oracle.readiness;
  refs.oraclePrice.textContent = formatPrice(oracle.priceDisplay, oracleView.quoteAsset);
  refs.oracleMeta.textContent = buildOracleMeta(oracle, oracleView);
  refs.oracleNote.textContent = oracle.note ?? "";
  refs.oraclePolicy.textContent = oracleView.policyId;
  refs.oracleAddress.textContent = oracleView.oracleAddress;
  refs.oracleReference.textContent = oracleView.referenceScript.addressShort;
  refs.oracleWindow.textContent = `ODV validity window: ${oracleView.validityWindowMinutes} minutes`;
  refs.nodeStrip.innerHTML = oracleView.nodes
    .map(
      (node) => `
        <article class="node-pill">
          <strong>${node.rootUrl}</strong>
          <div class="muted">pubKey ${node.pubKeyShort}</div>
        </article>
      `,
    )
    .join("");
}

function renderQuest(triggered = false) {
  const oracleView = state.selectedOracle;
  if (!oracleView) {
    return;
  }

  const oracle = oracleView.oracle;
  const profile = riskProfiles[state.risk];
  const readinessBonus = {
    live: 26,
    seeded: 14,
    "config-only": 6,
  }[oracle.readiness] ?? 4;

  const baseScore = Math.round(state.amount * profile.multiplier + state.streak * 17);
  const slippagePenalty = Math.round(state.slippage / 10);
  const questScore = Math.max(12, baseScore + readinessBonus - slippagePenalty);

  refs.questScore.textContent = String(questScore);
  refs.routeList.innerHTML = buildRouteSteps({
    oracleView,
    oracle,
    profile,
    questScore,
    triggered,
  });
  refs.narrative.textContent = buildNarrative({
    oracleView,
    oracle,
    profile,
    questScore,
    triggered,
  });
}

function buildRouteSteps({ oracleView, oracle, profile, questScore, triggered }) {
  const priceLine =
    oracle.priceDisplay === null
      ? "Waiting for first successful live read. Prototype stays in oracle-aware staging mode."
      : `Reference mid ${oracle.priceDisplay.toFixed(oracle.precision > 6 ? 6 : Math.max(2, oracle.precision))} ${oracleView.quoteAsset}.`;

  return [
    {
      title: "1. Lock the tap",
      copy: `${state.amount} ${oracleView.baseAsset} staged with ${state.slippage / 100}% slippage.`,
    },
    {
      title: "2. Read Charli3 ODV",
      copy: `${oracle.readiness} feed path. ${priceLine}`,
    },
    {
      title: "3. Score the loop",
      copy: `${profile.label} mode yields a ${questScore} point session forecast${triggered ? " after a fresh tap" : ""}.`,
    },
  ]
    .map(
      (step) => `
        <article class="route-step">
          <strong>${step.title}</strong>
          <div class="muted">${step.copy}</div>
        </article>
      `,
    )
    .join("");
}

function buildNarrative({ oracleView, oracle, profile, questScore, triggered }) {
  const liveLine =
    oracle.readiness === "live"
      ? "The public preprod Kupo endpoint answered, so this loop is using a fresh oracle read."
      : "This environment could not hydrate the public preprod feed just now, so the loop is falling back to the configured snapshot path.";

  return `${profile.line} ${liveLine} Current target: ${state.streak} clean taps on ${oracleView.displayName}, with an estimated ${questScore} point burst${triggered ? " after the latest run" : ""}.`;
}

function buildOracleMeta(oracle, oracleView) {
  const timestamps = [];

  if (oracle.createdAtMs) {
    timestamps.push(`created ${formatDate(oracle.createdAtMs)}`);
  }

  if (oracle.expiresAtMs) {
    timestamps.push(`expires ${formatDate(oracle.expiresAtMs)}`);
  }

  const extra = oracle.error ? `Last error: ${oracle.error}.` : "";
  const base = `${oracle.source} for ${oracleView.baseAsset}/${oracleView.quoteAsset}.`;

  return [base, timestamps.join(" • "), extra].filter(Boolean).join(" ");
}

function formatPrice(value, quoteAsset) {
  if (value === null || value === undefined) {
    return "Awaiting live feed";
  }

  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: 6,
  })} ${quoteAsset}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

