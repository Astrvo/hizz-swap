export const DEFAULT_MARKET_ID = "midnight-ada";
export const POLL_INTERVAL_MS = 500;

export const MARKET_CATALOG = {
  "midnight-ada": {
    id: "midnight-ada",
    displayName: "MIDnight / ADA",
    pair: "MIDnight/ADA",
    baseAsset: "MIDnight",
    quoteAsset: "ADA",
    quoteKind: "price-api",
    routeLabel: "Charli3 Token API / Aggregate",
    currentPoolId:
      "58d767ea21750e2b68db3b6de9ffc252a564f839e3093b6708029626e05f5035e78bdf98adbf4a3be012d4620dbc568ac05694605279822ffe126ead660763bd",
    minimumRenderablePrice: 0.00000001,
    fallbackMarketId: "snek-ada",
    note: "Aggregate MidKnight route. If the quote is too thin to render cleanly, the board auto-routes down the fallback chain.",
  },
  "snek-ada": {
    id: "snek-ada",
    displayName: "SNEK / ADA",
    pair: "SNEK/ADA",
    baseAsset: "SNEK",
    quoteAsset: "ADA",
    quoteKind: "price-api",
    routeLabel: "Charli3 Token API / MinswapV2",
    currentPoolId:
      "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c2ffadbb87144e875749122e0bbb9f535eeaa7f5660c6c4a91bcc4121e477f08d",
    minimumRenderablePrice: 0.00000001,
    fallbackMarketId: "ada-usd",
    note: "Most active fallback route for the tap board. Quotes come from the SNEK/ADA MinswapV2 pool via Charli3.",
  },
  "ada-usd": {
    id: "ada-usd",
    displayName: "ADA / USD",
    pair: "ADA/USD",
    baseAsset: "ADA",
    quoteAsset: "USD",
    quoteKind: "pull-oracle",
    routeLabel: "Charli3 Pull Oracle / Preprod",
    oracleId: "ada-usd-preprod",
    minimumRenderablePrice: 0.00000001,
    fallbackMarketId: null,
    note: "Oracle fallback route used when token-pair quotes are too thin or unavailable.",
  },
};

export const MARKET_OPTIONS = [
  {
    id: "midnight-ada",
    label: "MIDnight / ADA",
  },
  {
    id: "snek-ada",
    label: "SNEK / ADA",
  },
  {
    id: "ada-usd",
    label: "ADA / USD",
  },
];

export function getMarketDefinition(id) {
  return MARKET_CATALOG[id] ?? MARKET_CATALOG[DEFAULT_MARKET_ID];
}

export function listMarketOptions() {
  return MARKET_OPTIONS.map((option) => ({
    ...option,
    routeLabel: getMarketDefinition(option.id).routeLabel,
  }));
}
