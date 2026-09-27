# PulseDAG Explorer

A read-only explorer being prepared for PulseDAG v3.0.0 and the coordinated mainnet + parallel-testnet launch. The UI can run against deterministic mock data or poll the stable `/api/v1` RPC contract exposed by `pulsedagd`. It does not infer or invent mainnet identity values before the PulseDAG launch controls freeze them.

## Current capabilities

- Real node status from `GET /api/v1/status`
- Release/network identity metadata from `GET /api/v1/release`
- v3 monetary-policy metadata from `GET /api/v1/policy`, preserving large atom/Q64 fields as integer strings
- Fail-closed checks for release major, network profile, chain ID, optional monetary-policy fingerprint and inactive smart-contract state
- Sync and convergence state from `GET /api/v1/sync/status`
- Mempool counters from `GET /api/v1/mempool`
- Paginated mempool transactions from `GET /api/v1/txs/page`
- Paginated global pending and confirmed transaction activity from `GET /api/v1/txs/activity`
- PoW cadence and health from `GET /api/v1/pow/health`
- Recent DAG blocks from `GET /api/v1/blocks/recent`
- Paginated DAG history from `GET /api/v1/blocks/page`
- Block overview, parents and children from `GET /api/v1/blocks/:hash/overview`
- Paginated block transactions from `GET /api/v1/blocks/:hash/transactions`
- Transaction status, confirmations, inputs and outputs from `GET /api/v1/txs/:txid/lookup`
- Address balances and pending state from `GET /api/v1/address/:address/summary`
- Paginated confirmed and mempool address activity from `GET /api/v1/address/:address/activity`
- Search for block hashes, transaction IDs and known addresses through `GET /api/v1/search/:query`
- Linked navigation across blocks, child and parent blocks, transactions and addresses
- Shareable browser routes and pagination state for blocks, global transaction activity, mempool transactions and addresses
- Polling, bounded transient RPC retries, timeout handling, degraded-state warnings and explicit live/mock mode
- Dark and light themes with a responsive layout

The explorer deliberately avoids wallet, mining, mutation and admin endpoints.

## Run with mock data

```bash
npm install
npm run dev
```

Without environment configuration, the explorer starts in deterministic mock mode. Transaction and address details require a live read-only RPC connection. The transaction activity and mempool views return empty deterministic pages in mock mode.

## Connect a local PulseDAG node

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
VITE_RPC_TIMEOUT_MS=5000
VITE_RPC_MAX_RETRIES=1
VITE_RPC_RETRY_BASE_MS=300

# Pin these only to identities frozen by the PulseDAG launch controls.
VITE_EXPECTED_RELEASE_MAJOR=
VITE_EXPECTED_NETWORK_PROFILE=
VITE_EXPECTED_CHAIN_ID=
VITE_REQUIRE_CONTRACTS_DISABLED=true
VITE_EXPECTED_MONETARY_POLICY_FINGERPRINT=

PULSEDAG_RPC_TARGET=http://127.0.0.1:8080
```

`VITE_API_BASE_URL` may also point at a browser-accessible read-only gateway. It can be either the gateway root or a URL ending in `/api/v1`.

Transient read failures use bounded retries only. The default is one retry after a 300 ms base backoff, with a 5 s request timeout and a 5 s maximum retry delay. The retry count is clamped to at most two. Timeouts, network failures and selected transient HTTP statuses can retry; malformed responses, identity mismatches, incompatible releases/capabilities and smart-contract-boundary failures fail immediately.

## v3.0 / mainnet identity guard

Live mode reads `/api/v1/status` and `/api/v1/release` before presenting the node as healthy. For a v3 node it also requires `/api/v1/policy` and a valid `monetary_v3` contract. It rejects the connection when identity endpoints disagree, when the node does not advertise `explorer_api`, when monetary identity/encoding is malformed, when an optional monetary fingerprint pin mismatches, or when the v3.0 inactive-contract boundary is not proven.

The three expected identity variables are intentionally blank in `.env.example` while PulseDAG #1049 / Task31 has not frozen the independent mainnet and parallel-testnet identities. A production mainnet deployment must set all of:

- `VITE_EXPECTED_RELEASE_MAJOR=3`
- `VITE_EXPECTED_NETWORK_PROFILE=<frozen mainnet network profile>`
- `VITE_EXPECTED_CHAIN_ID=<frozen mainnet chain id>`

PulseDAG #1045 independently freezes the monetary-policy identity. Once that exact candidate is accepted, production should also set:

- `VITE_EXPECTED_MONETARY_POLICY_FINGERPRINT=<frozen #1045 fingerprint>`

Until the network values are pinned, the UI marks network identity as **verified, not pinned**. Until the monetary fingerprint is pinned, the v3 policy is likewise shown as verified-not-pinned. This prevents the explorer repository from becoming an accidental source of provisional consensus or mainnet constants.

`VITE_REQUIRE_CONTRACTS_DISABLED=true` is the v3.0 launch default. The explorer fails closed if `/status` reports contracts enabled or `/release` does not advertise the disabled-contract capability/state required by the v3.0 launch program.

See `docs/V3_MAINNET_READINESS.md` for the remaining exact-candidate and deployment gates.

## Shareable explorer routes

The explorer uses the browser History API without adding a client-side routing dependency:

```text
/                                      overview
/blocks                                first block page
/blocks?limit=50&offset=100            paginated DAG history
/transactions                          first global transaction activity page
/transactions?limit=50&offset=100      paginated pending and confirmed activity
/mempool                               first mempool transaction page
/mempool?limit=50&offset=100           paginated mempool transactions
/node                                  node health
/block/<hash>                           complete block overview and transaction pages
/tx/<txid>                              transaction details
/address/<address>                      first address activity page
/address/<address>?limit=20&offset=40   paginated address activity
```

Search results, pagination controls and linked entities update the URL. Browser back/forward navigation and direct page reloads are supported. Page sizes are bounded to 100 rows and offsets are clamped to non-negative integers.

Production servers must retain the SPA fallback already present in `deploy/nginx/pulsedag-explorer.conf`:

```nginx
try_files $uri $uri/ /index.html;
```

These browser routes do not expose RPC directly. Entity data still passes only through the explicit read-only `/rpc/api/v1/*` gateway routes.

## RPC contract fixtures

`fixtures/rpc/v2.3.0-readonly.json` remains the historical compatibility baseline captured from the exact approved PulseDAG v2.3.0 Linux candidate. Its provenance records the candidate SHA, workflow run, artifact ID and GitHub Actions artifact digest, and CI validates those bindings together with one linked block → transaction → address → activity contract.

`fixtures/rpc/v2.3.0-pagination.json` remains the historical pagination baseline from the same approved binary. Exact v3.0 fixtures must be captured from the frozen launch candidate before mainnet readiness is claimed.

Run the contract checks directly with:

```bash
npm run validate:fixtures
npm run validate:pagination
```

When a PulseDAG response field used by the explorer changes, update the adapter and the relevant fixture together. Fixtures are compatibility guards, not evidence that a public testnet is live.

The full capture procedure and safety boundary are recorded in `docs/LIVE_RPC_VALIDATION_V2_3_0.md`.

## Live RPC smoke test

With a compatible PulseDAG node already running on a loopback or private address:

```bash
PULSEDAG_RPC_BASE_URL=http://127.0.0.1:8080/api/v1 npm run smoke:live
```

The smoke test checks status, recent and paginated blocks, synchronization, mempool summary and transaction page, global transaction activity and its terminal boundary, PoW health, linked block overview, transaction lookup, address summary and paginated activity, exact block/transaction/address searches and the stable not-found response. It does not call write, wallet, mining or admin endpoints.

## Production read-only gateway

`deploy/nginx/pulsedag-explorer.conf` serves the built single-page application and proxies only the RPC routes used by the explorer. Its upstream name is `pulsedagd:8080`; adapt that service name to the deployment network without widening the route list.

The allowlist contains:

- status
- release/network identity metadata
- v3 monetary policy metadata
- recent blocks
- bounded block pagination with query preservation
- one block overview
- bounded block transaction pagination
- sync status
- mempool status
- exact mempool transaction pagination with query preservation
- exact global transaction activity pagination with query preservation
- PoW health
- exact transaction lookup
- bounded address summary
- bounded address activity with pagination query preservation
- exact search queries

Every other `/rpc/` request returns 404. Transaction IDs and block hashes are restricted to bounded hexadecimal paths, address paths use a bounded safe character set, and the configuration also sets a content security policy, framing protection, `nosniff`, no-referrer and a restrictive permissions policy.

Validate the gateway policy with:

```bash
npm run validate:proxy
```

## Security boundary

PulseDAG operator guidance keeps node RPC bound to loopback or a private service network. Do not expose `pulsedagd` directly to browsers. Do not forward `/admin`, wallet, mining, transaction-submission or other mutation routes, and do not embed an operator token in frontend environment variables.

This project is being migrated from its v2.3 private-testnet baseline toward v3.0/mainnet readiness. It does not claim that public testnet or mainnet is live, does not freeze network identities on behalf of PulseDAG #1049, and does not start or backdate any launch/burn-in clock.

## Validation

```bash
npm run validate:fixtures
npm run validate:pagination
npm run validate:proxy
npm run validate:v3-readiness
npm run typecheck
npm run build
```

For a separately running compatible node, also run `npm run smoke:live` with `PULSEDAG_RPC_BASE_URL` set to its stable `/api/v1` prefix. Before the mainnet launch, capture and validate exact v3.0 fixtures from the frozen candidate and pinned network identity.
