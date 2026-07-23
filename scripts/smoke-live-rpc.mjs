const configuredBase = process.env.PULSEDAG_RPC_BASE_URL || 'http://127.0.0.1:8080/api/v1'
const baseUrl = configuredBase.replace(/\/$/, '')

function fail(message) {
  throw new Error(`Live RPC smoke failed: ${message}`)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

async function request(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5_000)
  })
  assert(response.ok, `${path} returned HTTP ${response.status}`)
  const envelope = await response.json()
  assert(envelope && typeof envelope === 'object', `${path} returned a non-object response`)
  assert(envelope.ok === true, `${path} returned ok=false: ${envelope.error?.code || 'unknown error'}`)
  assert(envelope.data && typeof envelope.data === 'object', `${path} returned no data object`)
  assert(envelope.error === null, `${path} returned an error alongside ok=true`)
  assert(envelope.meta && typeof envelope.meta === 'object', `${path} returned no meta object`)
  return envelope.data
}

const [status, blocks, sync, mempool, pow] = await Promise.all([
  request('/status'),
  request('/blocks/recent?limit=20'),
  request('/sync/status'),
  request('/mempool'),
  request('/pow/health')
])

assert(status.version === 'v2.3.0', `expected v2.3.0, received ${status.version}`)
assert(typeof status.chain_id === 'string' && status.chain_id.length > 0, 'status chain_id is missing')
assert(status.rpc_response_degraded === false, 'status RPC response is degraded')
assert(status.rpc_response_stale === false, 'status RPC response is stale')
assert(Array.isArray(blocks.blocks) && blocks.blocks.length > 0, 'recent blocks returned no blocks')
assert(typeof sync.consistency_ok === 'boolean', 'sync consistency flag is missing')
assert(typeof sync.lag_blocks === 'number', 'sync lag_blocks is missing')
assert(typeof mempool.transaction_count === 'number', 'mempool transaction_count is missing')
assert(typeof pow.status === 'string', 'PoW health status is missing')

const head = blocks.blocks[0]
assert(status.selected_tip === head.hash, 'status selected_tip does not match the first recent block')
assert(status.best_height === head.height, 'status best_height does not match the first recent block')

const [overview, foundSearch, missingSearch] = await Promise.all([
  request(`/blocks/${encodeURIComponent(head.hash)}/overview`),
  request(`/search/${encodeURIComponent(head.hash)}`),
  request('/search/not-found')
])

assert(overview.hash === head.hash, 'block overview hash does not match the recent block')
assert(overview.height === head.height, 'block overview height does not match the recent block')
assert(Array.isArray(overview.parent_hashes), 'block overview parent_hashes is missing')
assert(foundSearch.found === true && foundSearch.kind === 'block', 'exact block search did not resolve the head block')
assert(foundSearch.hash === head.hash, 'exact block search returned a different hash')
assert(missingSearch.found === false && missingSearch.kind === 'unknown', 'missing search did not return the stable not-found shape')

console.log(JSON.stringify({
  base_url: baseUrl,
  version: status.version,
  chain_id: status.chain_id,
  best_height: status.best_height,
  head_hash: head.hash,
  peer_count: status.peer_count,
  sync_state: sync.sync_state,
  lag_blocks: sync.lag_blocks,
  mempool_transactions: mempool.transaction_count,
  pow_status: pow.status,
  pow_alerts: pow.alerts,
  result: 'pass'
}, null, 2))
