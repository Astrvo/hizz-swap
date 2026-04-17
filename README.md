# Hizz Swap

Hizz Swap is an **oracle-first prototype** for a gameified Cardano swap experience. The product direction is simple:

- make swapping feel fast, playful, and streak-based,
- keep price truth anchored to **Charli3 Pull Oracle / ODV**,
- leave room for a future execution layer that can graduate from demo loops into real swap flows.

This repo starts with the read path, not the full transaction path. That is deliberate. We want the UX and oracle architecture to be correct before we wire wallet signing and on-chain execution.

## What is already in this repo

- A lightweight zero-dependency Node server
- A branded single-screen prototype UI
- A small JSON config registry derived from the official Charli3 hackathon feed configs
- An oracle adapter that:
  - loads official preprod feed settings,
  - tries to read the latest feed data from the public synced preprod Kupo instance,
  - falls back to a seeded snapshot path when the live endpoint is unavailable
- A live market router that:
  - tries `MIDnight / ADA` first,
  - falls back to `SNEK / ADA` when the first market is too thin to visualize cleanly,
  - falls back again to `ADA / USD` pull-oracle mode when token-pair quotes are unavailable
- Initial project docs and milestone planning

## Why Charli3 is at the center

This prototype is explicitly built around **Charli3** rather than around a generic price API.

- Charli3 Pull Oracle gives us a request-driven oracle model that matches low-latency dApp use cases.
- Charli3 Token API gives us fast current-price reads for active Cardano pairs such as `SNEK / ADA`.
- The official preprod configs already include:
  - oracle address,
  - policy id,
  - reference script UTxO,
  - oracle node endpoints,
  - validity window
- The hackathon stack also exposes a public synced Ogmios and Kupo pair, which makes it possible to prototype the read path without deploying our own infrastructure first.

## Prototype architecture

```mermaid
flowchart LR
    A["Tap UI / play layer"] --> B["Hizz API layer"]
    B --> C["Charli3 config registry"]
    B --> D["Charli3 ODV feed reader"]
    B --> J["Charli3 Token API current quotes"]
    D --> E["Public Kupo preprod"]
    D --> F["Seeded snapshot fallback"]
    B --> G["Future execution adapter"]
    G --> H["Wallet + aggregation tx"]
    G --> I["Swap routing / execution"]
```

### Current layers

1. **Play layer**
   The browser UI stages swap size, risk mode, streak goals, and slippage presets.

2. **Oracle adapter**
   The Node backend loads official Charli3 market configs and attempts to hydrate feed state from Kupo.

3. **Live quote router**
   The Node backend now also calls Charli3 current-price routes for `MIDnight / ADA` and `SNEK / ADA`, then chooses the first market that returns a clean, renderable quote for the board.

4. **Fallback path**
   If the token-pair routes or public preprod endpoint are unreachable from the current environment, the backend still returns a truthful readiness state instead of pretending it is live.

### Next layer

5. **Execution adapter**
   This is where wallet connection, ODV aggregation, and swap construction will land next.

## Repo layout

```text
hizz-swap/
├─ oracle-configs/
│  ├─ ada-usd-preprod.json
│  ├─ btc-usd-preprod.json
│  └─ usdm-ada-preprod.json
├─ public/
│  ├─ app.js
│  ├─ index.html
│  └─ styles.css
├─ src/
│  └─ charli3/
│     ├─ config-store.mjs
│     ├─ oracle-service.mjs
│     └─ oracle-snapshots.mjs
├─ milestone.md
├─ package.json
└─ server.mjs
```

## Configured oracle markets

The repo currently ships these official preprod feeds:

- `ADA/USD`
- `BTC/USD`
- `USDM/ADA`

The original source for those definitions is the Charli3 hackathon resources repo. The JSON copies in this repo are normalized from the YAML files and rewritten to use the public synced preprod endpoints shared in the hackathon brief.

## How the current oracle read works

For a selected market:

1. Try the requested live pair route:
   - `MIDnight / ADA`
   - `SNEK / ADA`
2. If a live token-pair price is too thin or unavailable, route down the fallback chain
3. For `ADA / USD`, load the market config from `oracle-configs/`
4. Read the configured oracle contract address
5. Query the public Kupo instance at:
   - `http://35.209.192.203:1442`
6. Attempt to parse the first Charli3-style datum map containing:
   - price,
   - created time,
   - expiry time,
   - optional precision and symbols
7. Return one of three readiness states:
   - `live`
   - `seeded`
   - `config-only`

That readiness model is important. It prevents the UI from silently fabricating a "live" oracle if the environment cannot reach the public index.

## Running the prototype

### Requirements

- Node `24+`

### Install

No package installation is required for the current prototype.

### Start

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:3000
```

### Optional syntax check

```bash
npm run check
```

### Static demo build

To generate the Netlify-ready static dataset and publishable `public/` output:

```bash
npm run build
```

This produces `public/data/oracles.json`, which the frontend will use automatically whenever `/api` is not available.

## Netlify deployment mode

The repo now supports a Netlify deployment with a serverless quote route:

- `netlify.toml` sets `publish = "public"`
- Netlify runs `npm run build`
- Netlify Functions serve:
  - `GET /api/markets`
  - `GET /api/quote?market=midnight-ada|snek-ada|ada-usd`
- the frontend polls live routes every `2s`
- if the live route cannot hydrate, the UI falls back truthfully to oracle or static mode instead of faking a changing chart

### Required environment variable

- `CHARLI3_API_KEY`
  The scope must include **Functions** so Netlify can hydrate `MIDnight / ADA` and `SNEK / ADA` from the Charli3 Token API.

## Available API endpoints

### `GET /api/health`

Simple process heartbeat.

### `GET /api/oracles`

Returns the configured market rail:

- display name
- node count
- validity window
- shortened policy and address ids

### `GET /api/oracles/:id`

Returns:

- the full normalized Charli3 config for that market
- runtime node info
- oracle readiness
- parsed feed details when available
- fallback notes when live hydration fails

### `GET /api/markets`

Returns the supported UI market options and their route labels.

### `GET /api/quote?market=midnight-ada|snek-ada|ada-usd`

Returns:

- the requested market id
- the resolved market id actually powering the board
- the current price
- live or fallback readiness
- route label
- fallback reasoning
- a `2s` polling hint for the frontend sampler

## Product direction after this foundation

### Near term

- Improve ODV datum parsing for live preprod reads
- Surface richer oracle telemetry in the UI
- Move from staged tap sessions into transaction previews

### Next major build

- Add wallet integration
- Hook into the Charli3 ODV aggregation workflow
- Begin wiring the actual swap execution adapter

### Longer term

- Full tap-to-swap session loop
- Streaks, points, and shareable recap cards
- Live oracle-backed execution on Cardano

## Source map

Primary resources used for this foundation:

- [Charli3 hackathon resources](https://github.com/Charli3-Official/hackathon-resources)
- [Pull Oracle docs](https://docs.charli3.io/oracles/products/pull-oracle/summary)
- [Pull Oracle client](https://github.com/Charli3-Official/charli3-pull-oracle-client)
- [Datum demo reader](https://github.com/Charli3-Official/datum-demo-v3/tree/main)
- Public preprod sync endpoints from the hackathon brief:
  - `Ogmios: http://35.209.192.203:1337/`
  - `Kupo: http://35.209.192.203:1442/`

## Notes

- The current prototype is intentionally **read-first**.
- It already respects the "must use Charli3 oracle" constraint at the architecture level.
- Real swap execution is the next layer, not something hidden behind fake buttons today.

## License

MIT
