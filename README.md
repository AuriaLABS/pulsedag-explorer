# PulseDAG Explorer

A read-only explorer for the PulseDAG v2.3.0 private-testnet node API. The UI can run against deterministic mock data or poll the stable RPC contract exposed by `pulsedagd`.

## Current capabilities

- Real node status from `GET /api/v1/status`
- Sync and convergence state from `GET /api/v1/sync/status`
- Mempool counters from `GET /api/v1/mempool`
- PoW cadence and health from `GET /api/v1/pow/health`
- Recent DAG blocks from `GET /api/v1/blocks/recent`
- Block overview and parent hashes from `GET /api/v1/blocks/:hash/overview`
- Transaction status, confirmations, inputs and outputs from `GET /api/v1/txs/:txid/lookup`
- Address balances and pending state from `GET /api/v1/address/:address/summary`
- Paginated confirmed and mempool address activity from `GET /api/v1/address/:address/activity`
- Search for block hashes, transaction IDs and known addresses through `GET /api/v1/search/:query`
- Linked navigation from transaction to block/address and from address activity to transaction/block
- Shareable browser routes for blocks, transactions and addresses
- Polling, timeout handling, degraded-state warnings and explicit live/mock mode
- Dark and light themes with a responsive layout

The explorer deliberately avoids wallet, mining, mutation and admin endpoints.

## Run with mock data

```bash
npm install
npm run dev
```

Without environment configuration, the explorer starts in deterministic mock mode. Transaction and address details require a live read-only RPC connection.

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

## Shareable explorer routes

The explorer uses the browser History API without adding a client-side routing dependency:

```text
/                         overview
/blocks                   recent DAG blocks
/node                     node health
/block/<hash>              complete block overview
/tx/<txid>                 transaction details
/address/<address>         address summary and activity
```

Search results and linked entities update the URL. Browser back/forward navigation and direct page reloads are supported. Production servers must retain the SPA fallback already present in `deploy/nginx/pulsedag-explorer.conf`:

```nginx
try_files $uri $uri/ /index.html;
```

These browser routes do not broaden the RPC allowlist. Entity data still passes only through the explicit read-only `/rpc/api/v1/*` gateway routes.

## RPC contract fixture

`fixtures/rpc/v2.3.0-readonly.json` contains response fields captured from an isolated live run of the exact approved PulseDAG v2.3.0 Linux candidate. Its provenance records the candidate SHA, workflow run, artifact ID and GitHub Actions artifact digest, and CI validates those bindings together with one linked block → transaction → address → activity contract.

Run the contract check directly with:

```bash
npm run validate:fixtures
```

When a PulseDAG response field used by the explorer changes, update the adapter and the fixture together. The fixture is a compatibility guard, not evidence that a public testnet is live.

The full capture procedure and safety boundary are recorded in `docs/LIVE_RPC_VALIDATION_V2_3_0.md`.

## Live RPC smoke test

With a PulseDAG v2.3.0 node already running on a loopback or private address:

```bash
PULSEDAG_RPC_BASE_URL=http://127.0.0.1:8080/api/v1 npm run smoke:live
```

The smoke test checks status, recent blocks, synchronization, mempool, PoW health, linked block overview, transaction lookup, address summary and activity, exact block/transaction/address searches, and the stable not-found response. It does not call write, wallet, mining or admin endpoints.

## Production read-only gateway

`deploy/nginx/pulsedag-explorer.conf` serves the built single-page application and proxies only the RPC routes used by the explorer. Its upstream name is `pulsedagd:8080`; adapt that service name to the deployment network without widening the route list.

The allowlist contains:

- status
- recent blocks
- one block overview
- sync status
- mempool status
- PoW health
- exact transaction lookup
- bounded address summary
- bounded address activity with pagination query preservation
- exact search queries

Every other `/rpc/` request returns 404. Transaction IDs are restricted to bounded hexadecimal paths, address paths use a bounded safe character set, and the configuration also sets a content security policy, framing protection, `nosniff`, no-referrer and a restrictive permissions policy.

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

For a separately running v2.3.0 node, also run `npm run smoke:live` with `PULSEDAG_RPC_BASE_URL` set to its stable `/api/v1` prefix.
