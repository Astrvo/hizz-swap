export const ORACLE_SNAPSHOTS = {
  "ada-usd-preprod": {
    readiness: "seeded",
    source: "charli3-doc-sample",
    note: "Seeded from the example datum shown in the Charli3 datum standard docs while public preprod Kupo is unreachable from this dev environment.",
    priceInteger: 334136,
    precision: 6,
    priceDisplay: 0.334136,
    createdAtMs: 1678127888323,
    expiresAtMs: 1678129688323,
  },
  "btc-usd-preprod": {
    readiness: "config-only",
    source: "charli3-hackathon-config",
    note: "Config is loaded from the official hackathon YAML. A first live feed read is still pending.",
    priceInteger: null,
    precision: 6,
    priceDisplay: null,
    createdAtMs: null,
    expiresAtMs: null,
  },
  "usdm-ada-preprod": {
    readiness: "config-only",
    source: "charli3-hackathon-config",
    note: "Config is loaded from the official hackathon YAML. A first live feed read is still pending.",
    priceInteger: null,
    precision: 6,
    priceDisplay: null,
    createdAtMs: null,
    expiresAtMs: null,
  },
};

