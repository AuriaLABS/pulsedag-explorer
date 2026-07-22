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

## Security boundary

PulseDAG operator guidance keeps node RPC bound to loopback. For production, place a same-origin reverse proxy beside the explorer and expose only the read-only routes the UI needs. Do not forward `/admin`, wallet, mining or transaction-submission routes, and do not embed an operator token in frontend environment variables.

This project represents the private-testnet baseline. It does not claim that public testnet is live and does not start or backdate the 30-day public-testnet clock.

## Validation

```bash
npm run typecheck
npm run build
```
