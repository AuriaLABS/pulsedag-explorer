# PulseDAG Explorer

A read-only explorer for the PulseDAG v2.3.0 private-testnet node API. The UI can run against deterministic mock data or poll the stable RPC contract exposed by `pulsedagd`.

## Current capabilities

- Real node status from `GET /api/v1/status`
- Sync and convergence state from `GET /api/v1/sync/status`
- Mempool counters from `GET /api/v1/mempool`
- PoW cadence and health from `GET /api/v1/pow/health`
- Recent DAG blocks from `GET /api/v1/blocks/recent`
- Block overview and parent hashes from `GET /api/v1/blocks/:hash/overview`
- Search for block hashes, transaction IDs and known addresses through `GET /api/v1/search/:query`
- Polling, timeout handling, degraded-state warnings and explicit live/mock mode
- Dark and light themes with a responsive layout

The explorer deliberately avoids wallet, mining, mutation and admin endpoints.

## Run with mock data

```bash
npm install
npm run dev
```

Without environment configuration, the explorer starts in deterministic mock mode.

## Connect a local PulseDAG v2.3.0 node

```bash
cp .env.example .env.local
npm install
npm run dev
```

The default development setup calls `/rpc/api/v1/*`. Vite proxies `/rpc` to `http://127.0.0.1:8080`, so the browser never needs direct cross-origin access to the node.

Relevant values:

```env
VITE_DATA_MODE=live
VITE_API_BASE_URL=/rpc
VITE_POLL_INTERVAL_MS=15000
PULSEDAG_RPC_TARGET=http://127.0.0.1:8080
```

`VITE_API_BASE_URL` may also point at a browser-accessible read-only gateway. It can be either the gateway root or a URL ending in `/api/v1`.

## RPC contract fixture

`fixtures/rpc/v2.3.0-readonly.json` records representative successful responses for every read-only RPC surface consumed by the UI. It is intentionally limited to private-testnet, non-secret data and is validated in CI.

Run the contract check directly with:

```bash
npm run validate:fixtures
```

When a PulseDAG response field used by the explorer changes, update the adapter and the fixture together. The fixture is a compatibility guard, not evidence that a public testnet is live.

## Production read-only gateway

`deploy/nginx/pulsedag-explorer.conf` serves the built single-page application and proxies only the RPC routes used by the explorer. Its upstream name is `pulsedagd:8080`; adapt that service name to the deployment network without widening the route list.

The allowlist contains:

- status
- recent blocks
- one block overview
- sync status
- mempool status
- PoW health
- exact search queries

Every other `/rpc/` request returns 404. The configuration also sets a content security policy, framing protection, `nosniff`, no-referrer and a restrictive permissions policy.

Validate the gateway policy with:

```bash
npm run validate:proxy
```

## Security boundary

PulseDAG operator guidance keeps node RPC bound to loopback or a private service network. Do not expose `pulsedagd` directly to browsers. Do not forward `/admin`, wallet, mining, transaction-submission or other mutation routes, and do not embed an operator token in frontend environment variables.

This project represents the private-testnet baseline. It does not claim that public testnet is live and does not start or backdate the 30-day public-testnet clock.

## Validation

```bash
npm run validate:fixtures
npm run validate:proxy
npm run typecheck
npm run build
```
