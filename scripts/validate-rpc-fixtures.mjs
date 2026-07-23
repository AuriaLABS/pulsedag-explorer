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

const expectedCapture = {
  candidate_sha: '7e43225f01ac05d15e5f1e3f1550d7850bf18cbc',
  workflow_run: 29854712585,
  artifact_id: 8505066594,
  artifact_digest: 'sha256:f52c848ff3c6476fe5496ee1bbabcb9bc41eadaed4668c96a0d81c5fefc7e92f',
  network: 'dev'
}
assert(fixture.capture && typeof fixture.capture === 'object', 'capture provenance is required')
for (const [field, expected] of Object.entries(expectedCapture)) {
  assert(fixture.capture[field] === expected, `capture.${field} must match the approved artifact`)
}
assert(typeof fixture.capture.source === 'string' && fixture.capture.source.includes('approved Linux'), 'capture source must identify the approved Linux artifact')
assert(!Number.isNaN(Date.parse(fixture.capture.captured_at_utc)), 'capture.captured_at_utc must be a valid timestamp')

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
    selected_tip: 'nullable-string',
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

const status = fixture.responses['/api/v1/status'].data
assert(status.version === fixture.release_line, 'status version must match release_line')
assert(status.chain_id === 'pulsedag-devnet', 'live capture must identify the isolated dev network')
assert(status.rpc_response_degraded === false && status.rpc_response_stale === false, 'captured status must be fresh and non-degraded')

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

const headBlock = blocks[0]
assert(status.selected_tip === headBlock.hash, 'status selected_tip must match the first recent block')
assert(status.best_height === headBlock.height, 'status best_height must match the first recent block height')

const expectedOverviewEndpoint = `/api/v1/blocks/${headBlock.hash}/overview`
const overview = fixture.responses[expectedOverviewEndpoint]
assert(overview, `linked block overview is missing: ${expectedOverviewEndpoint}`)
assertEnvelope(expectedOverviewEndpoint, overview)
assertFields(expectedOverviewEndpoint, overview.data, {
  hash: 'string',
  height: 'number',
  blue_score: 'number',
  timestamp: 'number',
  parent_hashes: 'array',
  tx_count: 'number'
})
assert(overview.data.hash === headBlock.hash, 'block overview hash must match the recent block')
assert(overview.data.height === headBlock.height, 'block overview height must match the recent block')

const expectedSearchEndpoint = `/api/v1/search/${headBlock.hash}`
const search = fixture.responses[expectedSearchEndpoint]
assert(search, `linked successful search is missing: ${expectedSearchEndpoint}`)
assertEnvelope(expectedSearchEndpoint, search)
assertFields(expectedSearchEndpoint, search.data, {
  query: 'string',
  kind: 'string',
  found: 'boolean',
  hash: 'nullable-string',
  address: 'nullable-string',
  block_height: 'nullable-number',
  status: 'nullable-string'
})
assert(search.data.found === true, 'linked block search must be successful')
assert(search.data.kind === 'block', 'linked search must identify a block')
assert(search.data.hash === headBlock.hash, 'linked search hash must match the recent block')
assert(search.data.block_height === headBlock.height, 'linked search height must match the recent block')

const missingSearch = fixture.responses['/api/v1/search/not-found']
assert(missingSearch, 'not-found search response is required')
assertEnvelope('/api/v1/search/not-found', missingSearch)
assert(missingSearch.data.found === false, 'not-found search must report found=false')
assert(missingSearch.data.kind === 'unknown', 'not-found search must report kind=unknown')

console.log(`Validated ${Object.keys(fixture.responses).length} live-captured PulseDAG ${fixture.release_line} read-only RPC fixtures.`)
