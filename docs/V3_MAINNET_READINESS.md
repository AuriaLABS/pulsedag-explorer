# PulseDAG Explorer — v3.0 / mainnet readiness

This document tracks the explorer-specific path from the historical v2.3 private-testnet baseline to the exact PulseDAG v3.0.0 launch candidate.

The explorer is read-only. It must not become a source of provisional consensus, network, genesis, activation or launch constants.

## Current implemented baseline

- The browser uses the stable `/api/v1` namespace.
- `GET /api/v1/status` is required for live mode.
- `GET /api/v1/release` is required for live mode and is exposed through the deny-by-default gateway allowlist.
- Status and release chain IDs must agree.
- Status and release versions must agree.
- The node must advertise the `explorer_api` capability.
- Optional deployment pins can require an exact release major, network profile and chain ID.
- v3.0 launch mode requires contracts to remain inactive. The explorer rejects live readiness when `contracts_enabled` is true or release metadata does not advertise the disabled-contract state.
- The UI reports the network profile dynamically instead of hard-coding "Private testnet".
- Unknown RPC paths remain denied by the nginx gateway.

## Values that must not be invented yet

PulseDAG launch task #1049 owns the freeze for the independent mainnet and parallel-testnet identities. Until that work is evidence-backed, this repository must not hard-code guessed values for:

- mainnet network profile;
- mainnet chain ID;
- mainnet genesis hash;
- mainnet consensus/activation/config digest;
- parallel-testnet equivalents;
- public RPC/status/event hostnames;
- launch DNS/TLS identities.

The explorer environment leaves expected network profile and chain ID empty for this reason.

## Mainnet deployment gate

A production deployment may be labelled mainnet only when all of the following are true:

- PulseDAG #1049 has frozen the exact mainnet identity.
- The exact v3.0.0 source/artifact identity is frozen by the launch program.
- `VITE_EXPECTED_RELEASE_MAJOR=3`.
- `VITE_EXPECTED_NETWORK_PROFILE` equals the frozen mainnet profile.
- `VITE_EXPECTED_CHAIN_ID` equals the frozen mainnet chain ID.
- `VITE_REQUIRE_CONTRACTS_DISABLED=true`.
- The connected `/status` and `/release` responses pass the identity guard.
- The gateway exposes only the reviewed read-only explorer surface.
- Exact-candidate RPC fixtures and pagination fixtures have been captured and validated.
- The live smoke test passes against the frozen candidate.
- The explorer build is produced from a reviewed commit with green CI.

## Remaining implementation work

1. Capture exact v3.0 read-only and pagination fixtures once the launch candidate exists.
2. Extend fixture validation to include release identity, contract inactivity and any finalized v3 API fields.
3. Add exact-candidate smoke evidence for mainnet and parallel testnet independently.
4. Add production deployment manifests for the chosen hosting/runtime environment without exposing node admin, wallet, mining or mutation routes.
5. Pin final public RPC/gateway origin and CSP/CORS/TLS policy only after the launch infrastructure is frozen.
6. Review whether the fail-closed `/api/v1/explorer/block/:hash` DAG surface becomes active for v3.0. The existing stable block/overview routes remain the baseline and no inactive protocol surface should be enabled merely for the explorer.
7. Record final checksums/provenance for the explorer artifact alongside the v3 launch evidence.

## v3 smart-contract boundary

PulseDAG v3.0.0 launch planning explicitly keeps smart-contract activation out of the mainnet launch state. Explorer work must preserve that boundary:

- no contract deployment UI;
- no contract execution UI;
- no contract-specific mutation endpoints;
- no assumption that in-tree covenant/contract code is active;
- unknown future contract surfaces remain absent or fail closed.

A later protocol activation can add explorer support under a separately reviewed compatibility contract.
