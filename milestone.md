# Hizz Swap Milestones

## Current snapshot

- Product thesis: build a mobile-first, gameified Cardano swap flow where the "fun layer" sits on top of a serious oracle and routing stack.
- Oracle requirement: **Charli3 Pull Oracle / ODV is mandatory** for price truth and session state.
- Repo status: Day 1 foundation is now in place with docs, normalized Charli3 preprod configs, and a lightweight zero-dependency prototype shell.

## Day 1 progress

- Researched the Charli3 hackathon stack, including the official preprod ODV configs, public synced Ogmios and Kupo endpoints, the pull-oracle client, and the datum demo reader.
- Defined the first software architecture: `UI play layer -> oracle adapter -> future execution adapter`.
- Normalized three official preprod feeds into repo-owned config files:
  - `ADA/USD`
  - `BTC/USD`
  - `USDM/ADA`
- Shipped a lightweight Node prototype that:
  - serves a branded tap-swap interface,
  - reads the local Charli3 config registry,
  - attempts to hydrate live oracle state from the public preprod Kupo endpoint,
  - falls back gracefully to seeded config or sample data when the live endpoint is unreachable.

## Biggest challenge right now

- The main blocker is not UI. It is **reliable live oracle hydration and later on-chain execution orchestration** from this environment.
- In practice, the public preprod Kupo endpoint could not be reached from the current dev environment during implementation, so the prototype needs a clear fallback path while keeping the architecture oracle-first.
- The next technical jump is pairing the oracle read flow with actual Cardano wallet signing, aggregation submission, and swap execution without losing the playful tap UX.

## Day 2 priority

- Make the oracle adapter more production-like:
  - verify live reads against the public preprod services again,
  - add richer datum parsing for ODV aggregation state UTxOs,
  - expose better status telemetry in the UI.
- Start the execution layer:
  - define wallet integration boundaries,
  - sketch the ODV aggregation transaction flow,
  - prepare the swap execution adapter that will sit behind the tap interaction.

## Milestone ladder

### M0 — Foundation

- Status: done
- Deliverables:
  - repo bootstrap,
  - `README.md`,
  - `milestone.md`,
  - normalized Charli3 configs,
  - lightweight prototype UI and API.

### M1 — Oracle-first read path

- Status: in progress
- Goal:
  - reliably show live Charli3 ODV feed state per configured market,
  - surface readiness, timestamps, and parsing confidence.

### M2 — Tap loop gameplay

- Status: next
- Goal:
  - turn quote reads into a session mechanic with streaks, score, slippage tiers, and shareable moments.

### M3 — Execution adapter

- Status: planned
- Goal:
  - move from "session preview" into real Cardano execution preparation.
- Scope:
  - wallet hook,
  - oracle aggregation path,
  - swap route preparation,
  - transaction preview.

### M4 — Full alpha

- Status: planned
- Goal:
  - ship a true oracle-backed tap-to-swap alpha with live feeds, wallet connection, and first executable swap loop.

