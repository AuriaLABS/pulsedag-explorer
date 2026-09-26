# Read-only RPC load test

`scripts/load-live-rpc.mjs` is a bounded operator harness for measuring the explorer RPC surface before release. It performs only GET requests against routes already used by the explorer.

The harness performs the same fail-closed identity preflight used by launch smoke evidence before it sends load:

- `/status` and `/release` must agree on release and chain identity;
- `explorer_api` must be advertised;
- smart contracts must be reported inactive;
- optional expected release/network/chain pins must match.

If preflight fails, no load loop starts.

## Safe defaults

Without overrides:

- target: `http://127.0.0.1:8080/api/v1`;
- duration: 20 seconds;
- concurrency: 4;
- target rate: 20 requests/second;
- maximum requests: 500;
- request timeout: 5 seconds;
- maximum accepted error rate: 1%.

Only loopback/private IPv4, loopback/ULA IPv6, `localhost`, or the internal `pulsedagd` hostname are accepted by default.

A non-private target is rejected unless the operator explicitly sets:

```bash
PULSEDAG_LOAD_ALLOW_PUBLIC=true
```

Public-target runs are additionally clamped to at most 60 seconds, concurrency 8, 50 requests/second and 2,000 requests. This opt-in must only be used against an approved launch/staging gateway with an agreed load window.

## Usage

Local/private node:

```bash
PULSEDAG_RPC_BASE_URL=http://127.0.0.1:8080/api/v1 \
npm run load:live
```

Pinned v3 candidate:

```bash
PULSEDAG_RPC_BASE_URL=http://127.0.0.1:8080/api/v1 \
PULSEDAG_EXPECTED_RELEASE_MAJOR=3 \
PULSEDAG_EXPECTED_NETWORK_PROFILE=<frozen-profile> \
PULSEDAG_EXPECTED_CHAIN_ID=<frozen-chain-id> \
PULSEDAG_LOAD_DURATION_MS=60000 \
PULSEDAG_LOAD_CONCURRENCY=8 \
PULSEDAG_LOAD_RPS=50 \
PULSEDAG_LOAD_MAX_REQUESTS=2000 \
PULSEDAG_LOAD_MAX_ERROR_RATE=0.01 \
PULSEDAG_LOAD_MAX_P95_MS=500 \
npm run load:live
```

Do not substitute guessed identity values. Mainnet and parallel-testnet identities remain owned by PulseDAG #1049.

## Endpoints exercised

After discovery of one real block, transaction and address, the loop rotates across:

- paginated block history;
- global transaction activity;
- block overview;
- block transaction pagination;
- transaction lookup;
- address summary;
- address activity pagination;
- exact search.

The harness does not call wallet, mining, transaction submission, admin, snapshot mutation, pruning or repair routes.

## Output

The command prints JSON containing:

- release/network/chain identity;
- whether exact identity pins were configured;
- total issued/succeeded/failed requests;
- achieved request rate;
- error rate and error codes;
- p50/p95/p99/max latency;
- per-endpoint request counts and p50/p95 latency.

The command exits non-zero if the error-rate threshold is exceeded or, when configured, p95 latency exceeds `PULSEDAG_LOAD_MAX_P95_MS`.

## Evidence boundary

The harness is tooling, not release evidence by itself. Final launch evidence must record the exact source/binary identity, target network identity, gateway topology, run parameters, UTC window and resulting metrics. Public-load execution should be coordinated under the production infrastructure/rehearsal control in PulseDAG #1050.
