# PulseDAG v2.3.0 live RPC validation

Validation date: `2026-07-23 UTC`

## Purpose

Validate the explorer's complete read-only RPC surface against the exact approved PulseDAG v2.3.0 Linux candidate rather than relying only on synthetic or source-derived examples.

This evidence covers a single isolated development-network node. It is not public-testnet launch evidence, does not authorize public exposure, and does not start or backdate the 30-day public-testnet clock.

## Exact binary provenance

- Candidate source SHA: `7e43225f01ac05d15e5f1e3f1550d7850bf18cbc`
- Exact-candidate workflow run: `29854712585`
- Linux artifact ID: `8505066594`
- Linux artifact name: `v2_3_0_candidate_linux-x86_64_29854712585`
- GitHub Actions artifact digest: `sha256:f52c848ff3c6476fe5496ee1bbabcb9bc41eadaed4668c96a0d81c5fefc7e92f`
- Downloaded artifact digest: `sha256:f52c848ff3c6476fe5496ee1bbabcb9bc41eadaed4668c96a0d81c5fefc7e92f`
- Node archive: `pulsedagd-v2.3.0-x86_64-unknown-linux-gnu.tar.gz`
- Node archive digest: `sha256:bb364d39a7d3f54626ad8dd539e9cf45d07312c3bdc49192475a22a0fe8631d9`
- Matching archive checksum: verified with `sha256sum -c`

The outer artifact digest matched the immutable digest returned by GitHub Actions, and the inner node archive matched its packaged checksum before execution.

## Isolated launch

The node was launched without bootnodes, mining, wallet operations or public listeners:

```bash
pulsedagd \
  --network dev \
  --rpc-listen 127.0.0.1:18080 \
  --p2p-listen /ip4/127.0.0.1/tcp/19000
```

Safety boundary:

- network: `dev`
- RPC: loopback only
- P2P: loopback only
- bootnodes: none
- external peers: none
- mining: not started
- write/admin RPCs: not exercised

## Read-only endpoints exercised

The validation exercised every route consumed by the explorer:

- `GET /api/v1/status`
- `GET /api/v1/blocks/recent?limit=20`
- `GET /api/v1/sync/status`
- `GET /api/v1/mempool`
- `GET /api/v1/pow/health`
- `GET /api/v1/blocks/:hash/overview`
- `GET /api/v1/txs/:txid/lookup`
- `GET /api/v1/address/:address/summary`
- `GET /api/v1/address/:address/activity?limit=20&offset=0`
- `GET /api/v1/search/:query` with exact block, transaction and address identifiers
- `GET /api/v1/search/not-found`

## Observed linked contract

The exact binary returned:

- version: `v2.3.0`
- chain ID: `pulsedag-devnet`
- fresh, non-degraded `/status` response
- best height: `0`
- selected tip: `0828edfca48b1a43e407c4d9d7f63650552d9b86587f2565eba0c05977484047`
- recent block hash and height matching the selected tip and best height
- sync consistency: passing
- sync lag: `0`
- mempool transactions: `0`
- exact block overview: resolved
- linked transaction: `bfab773bc5ccf4326249fc6951f4dd3eccca2918ec4e063b0ee767a22c557f08`
- transaction status: `confirmed`
- transaction block hash and height matching the selected block
- transaction outputs: one output to `genesis-treasury` for `1000000000`
- address confirmed balance: `1000000000`
- address confirmed UTXOs: `1`
- address activity: one confirmed incoming entry linked to the same transaction and block
- exact searches: block, transaction and address all resolved with their stable kinds
- missing search: stable `found=false`, `kind=unknown` response

The isolated node correctly reported zero connected peers. PoW health was `degraded` because no PoW metric snapshots had been captured; its alerts were:

- `missing latest PoW metrics snapshot`
- `no PoW snapshots captured yet`
- `difficulty suggestion unavailable`

These warnings are expected for this bounded startup test and were not suppressed or relabelled as healthy.

## Reproducible smoke command

With a compatible v2.3.0 node already running:

```bash
PULSEDAG_RPC_BASE_URL=http://127.0.0.1:18080/api/v1 npm run smoke:live
```

The command follows the same linked path used by the interface: status and recent block, overview, transaction lookup, output address summary and activity, exact searches, and the stable missing search response.

Observed result fields:

```json
{
  "version": "v2.3.0",
  "chain_id": "pulsedag-devnet",
  "best_height": 0,
  "head_hash": "0828edfca48b1a43e407c4d9d7f63650552d9b86587f2565eba0c05977484047",
  "transaction_id": "bfab773bc5ccf4326249fc6951f4dd3eccca2918ec4e063b0ee767a22c557f08",
  "output_address": "genesis-treasury",
  "confirmed_balance": 1000000000,
  "address_activity_total": 1,
  "peer_count": 0,
  "sync_state": "synced",
  "lag_blocks": 0,
  "mempool_transactions": 0,
  "pow_status": "degraded",
  "result": "pass"
}
```

## Fixture binding

`fixtures/rpc/v2.3.0-readonly.json` contains the consumed response fields captured from this run. Its validator binds the fixture to the candidate SHA, workflow run, artifact ID and artifact digest, and verifies one consistent chain across:

1. node status and recent block;
2. block overview and transaction ID;
3. transaction lookup, block and output address;
4. address summary, balance and activity;
5. exact block, transaction and address searches.

## Conclusion

The explorer's block, transaction and address read-only adapter contract is compatible with the approved PulseDAG v2.3.0 Linux candidate in an isolated live-node test. Production deployment still requires the deny-by-default read-only reverse proxy and must not expose the node RPC directly to browsers.
