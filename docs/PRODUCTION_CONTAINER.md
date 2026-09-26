# Production container

This repository includes a production-oriented multi-stage container for the read-only PulseDAG explorer. It builds the Vite application with Node and serves only the compiled assets plus the reviewed nginx RPC allowlist at runtime.

The container does not freeze PulseDAG launch identity. Until PulseDAG #1049 freezes independent mainnet and parallel-testnet identities, the expected network-profile and chain-ID build arguments must remain empty.

## Build

For development or pre-freeze validation:

```bash
docker build -t pulsedag-explorer:candidate .
```

A build must not be advertised as mainnet unless the launch program has frozen the exact identity and the image is built with the corresponding values:

```bash
docker build \
  --build-arg VITE_EXPECTED_RELEASE_MAJOR=3 \
  --build-arg VITE_EXPECTED_NETWORK_PROFILE=<frozen-mainnet-profile> \
  --build-arg VITE_EXPECTED_CHAIN_ID=<frozen-mainnet-chain-id> \
  --build-arg VITE_REQUIRE_CONTRACTS_DISABLED=true \
  -t pulsedag-explorer:mainnet .
```

Do not replace the placeholders above with guessed values. The final launch image also needs an evidence-backed source SHA, CI run and image digest/checksum.

## Runtime boundary

The runtime image:

- contains the compiled SPA and nginx only;
- runs nginx as the unprivileged `nginx` user;
- listens on port 8080;
- exposes `GET /healthz` as a local liveness check;
- proxies only the explicit read-only `/rpc/api/v1/*` allowlist;
- expects the private runtime DNS name `pulsedagd` to resolve to the node RPC service;
- does not contain wallet, mining, transaction-submission or admin credentials/routes.

The `pulsedagd` RPC port must stay private. Publish the explorer port through the chosen ingress/CDN; do not publish the node RPC port directly.

## Health semantics

`/healthz` proves only that the explorer nginx process is serving requests. It intentionally does not proxy to the node and therefore cannot prove PulseDAG identity, synchronization or release readiness.

Network readiness remains fail-closed in the browser and live smoke checks:

- `/api/v1/status` and `/api/v1/release` must agree;
- `explorer_api` must be advertised;
- the configured frozen release/network/chain pins must match when present;
- smart contracts must remain inactive for the v3.0 launch state.

## Rate limiting and caching

Final client-aware public rate limits are intentionally not hard-coded in this image yet. PulseDAG #1050 still owns the final public RPC limits/rate/CORS/TLS boundary, and the trusted proxy/client-IP chain is not frozen. Applying a per-IP limiter inside this container before that topology is known could rate-limit an entire CDN or load balancer as one client.

The final ingress should own client-aware abuse controls once trusted forwarding and public origins are frozen. The explorer nginx layer keeps bounded upstream timeouts and the exact read-only route allowlist in the meantime.

## CI gates

Explorer CI validates:

1. static container safety policy;
2. nginx syntax and dynamic RPC routing semantics;
3. TypeScript and production Vite build;
4. production image build;
5. container startup as user `nginx`;
6. `/healthz` response and Docker health state.

The final launch step must additionally pin base-image digests and record the built explorer image digest/checksum alongside the v3 release evidence.
