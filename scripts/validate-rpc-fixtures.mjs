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

function requireResponse(endpoint, fields) {
  const envelope = fixture.responses[endpoint]
  assert(envelope, `${endpoint} response is missing`)
  assertEnvelope(endpoint, envelope)
  if (fields) assertFields(endpoint, envelope.data, fields)
  return envelope.data
}

function validateSearch(endpoint, expected) {
  const data = requireResponse(endpoint, {
    query: 'string',
    kind: 'string',
    found: 'boolean',
    hash: 'nullable-string',
    address: 'nullable-string',
    block_height: 'nullable-number',
    status: 'nullable-string'
  })
  for (const [field, value] of Object.entries(expected)) {
    assert(data[field] === value, `${endpoint}.data.${field} must equal ${String(value)}`)
  }
  return data
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
assert(typeof fixture.capture.scope === 'string' && fixture.capture.scope.includes('transaction') && fixture.capture.scope.includes('address'), 'capture scope must include transaction and address evidence')

const status = requireResponse('/api/v1/status', {
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
})

requireResponse('/api/v1/sync/status', {
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
})

requireResponse('/api/v1/mempool', {
  transaction_count: 'number',
  orphan_transaction_count: 'number',
  orphan_limit: 'number',
  spent_outpoints_count: 'number',
  txids: 'array'
})

requireResponse('/api/v1/pow/health', {
  status: 'string',
  snapshot_count: 'number',
  latest_suggested_difficulty: 'number',
  latest_avg_block_interval_secs: 'number',
  alerts: 'array'
})

const blocksData = requireResponse('/api/v1/blocks/recent?limit=20', {
  count: 'number',
  total: 'number',
  limit: 'number',
  offset: 'number',
  has_more: 'boolean',
  blocks: 'array'
})

assert(status.version === fixture.release_line, 'status version must match release_line')
assert(status.chain_id === 'pulsedag-devnet', 'live capture must identify the isolated dev network')
assert(status.rpc_response_degraded === false && status.rpc_response_stale === false, 'captured status must be fresh and non-degraded')
assert(blocksData.blocks.length > 0, 'recent blocks fixture must contain at least one block')

for (const [index, block] of blocksData.blocks.entries()) {
  assertFields(`recent blocks[${index}]`, block, {
    hash: 'string',
    height: 'number',
    blue_score: 'number',
    tx_count: 'number',
    timestamp: 'number',
    parent_count: 'number'
  })
}

const headBlock = blocksData.blocks[0]
assert(status.selected_tip === headBlock.hash, 'status selected_tip must match the first recent block')
assert(status.best_height === headBlock.height, 'status best_height must match the first recent block height')

const overviewEndpoint = `/api/v1/blocks/${headBlock.hash}/overview`
const overview = requireResponse(overviewEndpoint, {
  hash: 'string',
  height: 'number',
  blue_score: 'number',
  timestamp: 'number',
  parent_hashes: 'array',
  tx_count: 'number',
  txids: 'array'
})
assert(overview.hash === headBlock.hash, 'block overview hash must match the recent block')
assert(overview.height === headBlock.height, 'block overview height must match the recent block')
assert(overview.txids.length > 0, 'captured block overview must contain a transaction')

const txid = overview.txids[0]
const transactionEndpoint = `/api/v1/txs/${txid}/lookup`
const transaction = requireResponse(transactionEndpoint, {
  txid: 'string',
  status: 'string',
  is_mempool: 'boolean',
  is_confirmed: 'boolean',
  fee: 'number',
  nonce: 'number',
  block_hash: 'nullable-string',
  block_height: 'nullable-number',
  confirmations: 'nullable-number',
  inputs: 'array',
  outputs: 'array'
})
assert(transaction.txid === txid, 'transaction lookup must match the block transaction ID')
assert(transaction.block_hash === headBlock.hash, 'transaction block hash must match the head block')
assert(transaction.block_height === headBlock.height, 'transaction block height must match the head block')
assert(transaction.is_confirmed === true && transaction.status === 'confirmed', 'captured transaction must be confirmed')
assert(transaction.outputs.length > 0, 'captured transaction must contain an output')
for (const [index, input] of transaction.inputs.entries()) {
  assertFields(`transaction inputs[${index}]`, input, { txid: 'string', index: 'number' })
}
for (const [index, output] of transaction.outputs.entries()) {
  assertFields(`transaction outputs[${index}]`, output, { address: 'string', amount: 'number' })
}

const output = transaction.outputs[0]
const summaryEndpoint = `/api/v1/address/${output.address}/summary`
const summary = requireResponse(summaryEndpoint, {
  address: 'string',
  confirmed_balance: 'number',
  confirmed_utxo_count: 'number',
  pending_incoming: 'number',
  pending_outgoing: 'number',
  pending_net: 'number',
  mempool_tx_count: 'number',
  mempool_txids: 'array',
  mempool_explicit: 'boolean'
})
assert(summary.address === output.address, 'address summary must match the transaction output address')
assert(summary.confirmed_balance === output.amount, 'captured address balance must match its genesis output')

const activityEndpoint = `/api/v1/address/${output.address}/activity?limit=20&offset=0`
const activity = requireResponse(activityEndpoint, {
  address: 'string',
  count: 'number',
  total: 'number',
  limit: 'number',
  offset: 'number',
  has_more: 'boolean',
  activity: 'array'
})
assert(activity.address === output.address, 'address activity must match the transaction output address')
assert(activity.activity.length > 0, 'captured address must contain activity')
for (const [index, item] of activity.activity.entries()) {
  assertFields(`address activity[${index}]`, item, {
    txid: 'string',
    direction: 'string',
    incoming: 'number',
    outgoing: 'number',
    net: 'number',
    context: 'string',
    is_mempool: 'boolean',
    is_confirmed: 'boolean',
    block_hash: 'nullable-string',
    block_height: 'nullable-number'
  })
}
const firstActivity = activity.activity[0]
assert(firstActivity.txid === txid, 'address activity transaction must match the captured transaction')
assert(firstActivity.block_hash === headBlock.hash, 'address activity block must match the captured block')
assert(firstActivity.incoming === output.amount, 'address activity incoming amount must match the transaction output')

validateSearch(`/api/v1/search/${headBlock.hash}`, {
  found: true,
  kind: 'block',
  hash: headBlock.hash,
  block_height: headBlock.height
})
validateSearch(`/api/v1/search/${txid}`, {
  found: true,
  kind: 'transaction',
  hash: txid,
  block_height: headBlock.height
})
validateSearch(`/api/v1/search/${output.address}`, {
  found: true,
  kind: 'address',
  address: output.address,
  status: 'known'
})
validateSearch('/api/v1/search/not-found', {
  found: false,
  kind: 'unknown',
  hash: null,
  address: null,
  block_height: null,
  status: null
})

console.log(`Validated ${Object.keys(fixture.responses).length} linked live-captured PulseDAG ${fixture.release_line} read-only RPC fixtures.`)
