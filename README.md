# PulseDAG Explorer

A first-pass testnet explorer UI for PulseDAG. The project works immediately with mock data and can switch to a real node or indexer API through one environment variable.

## Included in this MVP

- Network overview with DAG height, throughput, active nodes and median finality
- Interactive recent-event DAG visualization
- Search by event hash or node identifier
- Latest event feed with a detail drawer
- Network-node status view
- Dark and light themes
- Responsive mobile layout
- Typed API adapter with mock-data fallback

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:4173`.

## Connect a real API

Copy the example environment file:

```bash
cp .env.example .env.local
```

Then set:

```env
VITE_API_BASE_URL=http://localhost:8080
```

The initial client expects these endpoints:

- `GET /v1/network/stats`
- `GET /v1/events?limit=20`
- `GET /v1/nodes`
- `GET /v1/search?q=<query>`

Until `VITE_API_BASE_URL` is configured, the explorer uses deterministic mock data from `src/data/mock.ts`.

## Next integration steps

1. Confirm the PulseDAG node or indexer response schemas.
2. Map API responses to the interfaces in `src/types.ts`.
3. Add event pagination and transaction and address detail routes.
4. Replace polling with WebSocket or server-sent updates when the node API supports them.
5. Add end-to-end tests against the public testnet.
