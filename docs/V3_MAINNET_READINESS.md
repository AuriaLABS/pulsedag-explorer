# PulseDAG Explorer — v3.0 / mainnet readiness

This document tracks the explorer-specific path from the historical v2.3 private-testnet baseline to the exact PulseDAG v3.0.0 launch candidate.

The explorer is read-only. It must not become a source of provisional consensus, network, genesis, activation or launch constants.

## Current implemented baseline

- The browser uses the stable `/api/v1` namespace.
- `GET /api/v1/status` is required for live mode.
- `GET /api/v1/release` is required for live mode and is exposed through the deny-by-default gateway allowlist.
- PulseDAG v3 additionally requires `GET /api/v1/policy`; the explorer consumes `monetary_v3` as downstream metadata and never originates monetary constants.
- v3 monetary atom/Q64 fields are accepted only as decimal integer strings so browser number precision cannot silently change consensus-facing values.
- An optional `VITE_EXPECTED_MONETARY_POLICY_FINGERPRINT` deployment pin fails closed on a policy mismatch.
- Status and release chain IDs must agree.
- Status and release versions must agree.
- The node must advertise the `explorer_api` capability.
- Optional deployment pins can require an exact release major, network profile and chain ID.
- v3.0 launch mode requires contracts to remain inactive. The explorer rejects live readiness when `contracts_enabled` is true or release metadata does not advertise the disabled-contract state.
- The UI reports the network profile dynamically instead of hard-coding "Private testnet".
- Unknown RPC paths remain denied by the nginx gateway.
- Read-only browser RPC calls use a bounded transient-failure retry policy: 5 s timeout, one retry by default, exponential backoff from 300 ms, and a 5 s maximum delay. Identity, compatibility and contract-boundary failures are non-retryable.

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

PulseDAG #1045 separately owns the production monetary-policy freeze. `VITE_EXPECTED_MONETARY_POLICY_FINGERPRINT` also remains blank in the repository until the exact #1045 candidate is accepted and evidence-bound. The explorer may display policy metadata before that pin exists, but it reports the policy as verified-not-pinned and does not treat it as launch authority.

## Mainnet deployment gate

A production deployment may be labelled mainnet only when all of the following are true:

- PulseDAG #1049 has frozen the exact mainnet identity.
- The exact v3.0.0 source/artifact identity is frozen by the launch program.
- `VITE_EXPECTED_RELEASE_MAJOR=3`.
- `VITE_EXPECTED_NETWORK_PROFILE` equals the frozen mainnet profile.
- `VITE_EXPECTED_CHAIN_ID` equals the frozen mainnet chain ID.
- `VITE_EXPECTED_MONETARY_POLICY_FINGERPRINT` equals the final fingerprint frozen by PulseDAG #1045.
- `VITE_REQUIRE_CONTRACTS_DISABLED=true`.
- The connected `/status`, `/release` and v3 `/policy` responses pass the identity and monetary-policy guards.
- If production monetary cadence is reported frozen, its cadence fingerprint must be a valid 32-byte hex identity.
- The gateway exposes only the reviewed read-only explorer surface.
- Exact-candidate RPC fixtures and pagination fixtures have been captured and validated.
- The live smoke test passes against the frozen candidate.
- Production retry settings remain bounded and do not convert identity or contract-boundary failures into retries.
- The explorer build is produced from a reviewed commit with green CI.

## Remaining implementation work

1. Capture exact v3.0 read-only and pagination fixtures once the launch candidate exists.
2. Extend fixture validation to include release identity, contract inactivity, the exact v3 monetary-policy fingerprint and finalized v3 API fields.
3. Add exact-candidate smoke evidence for mainnet and parallel testnet independently.
4. Add production deployment manifests for the chosen hosting/runtime environment without exposing node admin, wallet, mining or mutation routes.
5. Pin final public RPC/gateway origin and CSP/CORS/TLS policy only after the launch infrastructure is frozen.
6. Review whether the fail-closed `/api/v1/explorer/block/:hash` DAG surface becomes active for v3.0. The existing stable block/overview routes remain the baseline and no inactive protocol surface should be enabled merely for the explorer.
7. Record final checksums/provenance for the explorer artifact alongside the v3 launch evidence.

## RPC resilience boundary

The browser retry policy exists only to smooth transient read failures. The reviewed defaults are:

- `VITE_RPC_TIMEOUT_MS=5000`;
- `VITE_RPC_MAX_RETRIES=1` (clamped to at most 2);
- `VITE_RPC_RETRY_BASE_MS=300`;
- retry delay capped at 5 seconds;
- retryable HTTP statuses limited to 408, 425, 429, 500, 502, 503 and 504;
- timeout and browser network failures are retryable;
- response-shape errors, identity mismatches, release/capability mismatches and smart-contract-boundary violations are not retryable.

The explorer remains read-only, so retries never repeat wallet, mining, transaction submission, admin or other mutation operations.

## v3 smart-contract boundary

PulseDAG v3.0.0 launch planning explicitly keeps smart-contract activation out of the mainnet launch state. Explorer work must preserve that boundary:

- no contract deployment UI;
- no contract execution UI;
- no contract-specific mutation endpoints;
- no assumption that in-tree covenant/contract code is active;
- unknown future contract surfaces remain absent or fail closed.

A later protocol activation can add explorer support under a separately reviewed compatibility contract.
