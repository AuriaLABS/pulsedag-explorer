import { readFileSync } from 'node:fs'

const fixturePath = new URL('../fixtures/rpc/v2.3.0-readonly.json', import.meta.url)
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))

function fail(message) {
  throw new Error(`RPC fixture validation failed: ${message}`)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function assertEnvelope(endpoint, envelope) {
  assert(envelope && typeof envelope === 'object', `${endpoint} must be an object`)
  assert(typeof envelope.ok === 'boolean', `${endpoint}.ok must be boolean`)
  assert('data' in envelope, `${endpoint}.data is required`)
  assert('error' in envelope, `${endpoint}.error is required`)
  assert(envelope.meta && typeof envelope.meta === 'object' && !Array.isArray(envelope.meta), `${endpoint}.meta must be an object`)
  if (envelope.ok) {
    assert(envelope.data && typeof envelope.data === 'object', `${endpoint}.data must be an object when ok=true`)
    assert(envelope.error === null, `${endpoint}.error must be null when ok=true`)
  }
}

function assertFields(endpoint, data, fields) {
  for (const [field, expectedType] of Object.entries(fields)) {
    assert(field in data, `${endpoint}.data.${field} is required`)
    const value = data[field]
    if (expectedType === 'array') {
      assert(Array.isArray(value), `${endpoint}.data.${field} must be an array`)
    } else if (expectedType === 'nullable-string') {
      assert(value === null || typeof value === 'string', `${endpoint}.data.${field} must be string|null`)
    } else if (expectedType === 'nullable-number') {
      assert(value === null || typeof value === 'number', `${endpoint}.data.${field} must be number|null`)
    } else {
      assert(typeof value === expectedType, `${endpoint}.data.${field} must be ${expectedType}`)
    }
  }
}

assert(fixture.release_line === 'v2.3.0', 'release_line must be v2.3.0')
assert(fixture.stable_prefix === '/api/v1', 'stable_prefix must be /api/v1')
assert(fixture.responses && typeof fixture.responses === 'object', 'responses object is required')

const contracts = {
  '/api/v1/status': {
    rpc_response_degraded: 'boolean',
    rpc_response_stale: 'boolean',
    rpc_response_degraded_reason: 'nullable-string',
    network_id: 'string',
    service: 'string',
    version: 'string',
    chain_id: 'string',
    best_height: 'number',
    block_count: 'number',
    consensus_mode: 'string',
    tip_count: 'number',
    mempool_size: 'number',
    snapshot_height: 'nullable-number',
    p2p_mode: 'nullable-string',
    peer_count: 'number',
    sync_state: 'string',
    storage_backend: 'string'
  },
  '/api/v1/sync/status': {
    rpc_response_degraded: 'boolean',
    rpc_response_stale: 'boolean',
    consistency_ok: 'boolean',
    consistency_issue_count: 'number',
    lag_blocks: 'number',
    sync_state: 'string',
    network_selected_height_gap: 'number',
    storage_replay_gap: 'number',
    live_sync_error_active: 'number',
    p2p_ready_for_private_rehearsal: 'boolean',
    readiness_reasons: 'array'
  },
  '/api/v1/mempool': {
    transaction_count: 'number',
    orphan_transaction_count: 'number',
    orphan_limit: 'number',
    spent_outpoints_count: 'number',
    txids: 'array'
  },
  '/api/v1/pow/health': {
    status: 'string',
    snapshot_count: 'number',
    latest_suggested_difficulty: 'number',
    latest_avg_block_interval_secs: 'number',
    alerts: 'array'
  },
  '/api/v1/blocks/recent?limit=20': {
    count: 'number',
    total: 'number',
    limit: 'number',
    offset: 'number',
    has_more: 'boolean',
    blocks: 'array'
  }
}

for (const [endpoint, fields] of Object.entries(contracts)) {
  const envelope = fixture.responses[endpoint]
  assert(envelope, `${endpoint} response is missing`)
  assertEnvelope(endpoint, envelope)
  assertFields(endpoint, envelope.data, fields)
}

const blocks = fixture.responses['/api/v1/blocks/recent?limit=20'].data.blocks
assert(blocks.length > 0, 'recent blocks fixture must contain at least one block')
for (const [index, block] of blocks.entries()) {
  assertFields(`recent blocks[${index}]`, block, {
    hash: 'string',
    height: 'number',
    blue_score: 'number',
    tx_count: 'number',
    timestamp: 'number',
    parent_count: 'number'
  })
}

const overviewEndpoint = Object.keys(fixture.responses).find((endpoint) => endpoint.endsWith('/overview'))
assert(overviewEndpoint, 'a block overview response is required')
const overview = fixture.responses[overviewEndpoint]
assertEnvelope(overviewEndpoint, overview)
assertFields(overviewEndpoint, overview.data, {
  hash: 'string',
  height: 'number',
  blue_score: 'number',
  timestamp: 'number',
  parent_hashes: 'array',
  tx_count: 'number'
})

const searchEndpoint = Object.keys(fixture.responses).find((endpoint) => endpoint.startsWith('/api/v1/search/'))
assert(searchEndpoint, 'a search response is required')
const search = fixture.responses[searchEndpoint]
assertEnvelope(searchEndpoint, search)
assertFields(searchEndpoint, search.data, {
  query: 'string',
  kind: 'string',
  found: 'boolean',
  hash: 'nullable-string',
  address: 'nullable-string',
  block_height: 'nullable-number',
  status: 'nullable-string'
})

console.log(`Validated ${Object.keys(fixture.responses).length} PulseDAG ${fixture.release_line} read-only RPC fixtures.`)
