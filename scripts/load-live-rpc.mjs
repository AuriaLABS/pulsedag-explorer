const configuredBase = process.env.PULSEDAG_RPC_BASE_URL || 'http://127.0.0.1:8080/api/v1'
const baseUrl = configuredBase.replace(/\/$/, '')
const parsedBase = new URL(baseUrl)

function fail(message) {
  throw new Error(`Read-only load test failed: ${message}`)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function numberEnv(name, fallback, min, max, integer = true) {
  const raw = process.env[name]
  const parsed = raw === undefined || raw === '' ? fallback : Number(raw)
  if (!Number.isFinite(parsed)) fail(`${name} must be a finite number`)
  const bounded = Math.min(max, Math.max(min, parsed))
  return integer ? Math.floor(bounded) : bounded
}

function isPrivateHostname(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host === '::1' || host === 'pulsedagd') return true
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true
  const match172 = host.match(/^172\.(\d{1,3})\./)
  if (match172) {
    const second = Number(match172[1])
    if (second >= 16 && second <= 31) return true
  }
  if (/^(fc|fd)[0-9a-f:]*$/i.test(host)) return true
  return false
}

const allowPublic = (process.env.PULSEDAG_LOAD_ALLOW_PUBLIC || '').trim().toLowerCase() === 'true'
if (!isPrivateHostname(parsedBase.hostname) && !allowPublic) {
  fail('refusing a non-private target; set PULSEDAG_LOAD_ALLOW_PUBLIC=true only for an explicitly approved public load test')
}

const publicTarget = !isPrivateHostname(parsedBase.hostname)
const durationMs = numberEnv('PULSEDAG_LOAD_DURATION_MS', 20_000, 5_000, publicTarget ? 60_000 : 300_000)
const concurrency = numberEnv('PULSEDAG_LOAD_CONCURRENCY', 4, 1, publicTarget ? 8 : 32)
const targetRps = numberEnv('PULSEDAG_LOAD_RPS', 20, 1, publicTarget ? 50 : 200)
const maxRequests = numberEnv('PULSEDAG_LOAD_MAX_REQUESTS', 500, 10, publicTarget ? 2_000 : 20_000)
const timeoutMs = numberEnv('PULSEDAG_LOAD_TIMEOUT_MS', 5_000, 1_000, 15_000)
const maxErrorRate = numberEnv('PULSEDAG_LOAD_MAX_ERROR_RATE', 0.01, 0, 1, false)
const configuredP95 = process.env.PULSEDAG_LOAD_MAX_P95_MS
const maxP95Ms = configuredP95 ? numberEnv('PULSEDAG_LOAD_MAX_P95_MS', 0, 1, 60_000) : null
const workerDelayMs = Math.max(0, Math.round((concurrency * 1_000) / targetRps))

async function requestData(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  })
  assert(response.ok, `${path} returned HTTP ${response.status}`)
  const envelope = await response.json()
  assert(envelope && typeof envelope === 'object', `${path} returned a non-object response`)
  assert(envelope.ok === true, `${path} returned ok=false: ${envelope.error?.code || 'unknown error'}`)
  assert(envelope.data && typeof envelope.data === 'object', `${path} returned no data object`)
  return envelope.data
}

function sleep(ms) {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[index]
}

const [status, release, recent, blockPage, txActivity] = await Promise.all([
  requestData('/status'),
  requestData('/release'),
  requestData('/blocks/recent?limit=20'),
  requestData('/blocks/page?limit=100&offset=0'),
  requestData('/txs/activity?limit=100&offset=0'),
])

assert(typeof status.chain_id === 'string' && status.chain_id.length > 0, 'status chain_id is missing')
assert(typeof release.chain_id === 'string' && release.chain_id.length > 0, 'release chain_id is missing')
assert(status.chain_id === release.chain_id, 'status and release chain IDs differ')
assert(status.version === release.version, 'status and release versions differ')
assert(Array.isArray(release.capabilities) && release.capabilities.includes('explorer_api'), 'release does not advertise explorer_api')
assert(status.contracts_enabled === false, 'status reports smart contracts enabled')
assert(release.capabilities.includes('contracts_disabled'), 'release does not advertise contracts_disabled')
assert(typeof release.smart_contracts === 'string' && release.smart_contracts.toLowerCase().startsWith('disabled'), 'release smart-contract state is not disabled')

const expectedReleaseMajor = (process.env.PULSEDAG_EXPECTED_RELEASE_MAJOR || '').replace(/^v/i, '')
const expectedNetworkProfile = process.env.PULSEDAG_EXPECTED_NETWORK_PROFILE || ''
const expectedChainId = process.env.PULSEDAG_EXPECTED_CHAIN_ID || ''
if (expectedReleaseMajor) {
  assert(release.version.replace(/^v/i, '').split('.')[0] === expectedReleaseMajor, `expected release major v${expectedReleaseMajor}, received ${release.version}`)
}
if (expectedNetworkProfile) {
  assert(release.network_profile === expectedNetworkProfile, `expected network profile ${expectedNetworkProfile}, received ${release.network_profile}`)
}
if (expectedChainId) {
  assert(release.chain_id === expectedChainId, `expected chain ID ${expectedChainId}, received ${release.chain_id}`)
}

assert(Array.isArray(recent.blocks) && recent.blocks.length > 0, 'recent blocks returned no blocks')
assert(Array.isArray(blockPage.blocks) && blockPage.blocks.length > 0, 'block page returned no blocks')
assert(Array.isArray(txActivity.transactions), 'transaction activity returned no transaction array')

const head = recent.blocks[0]
const overview = await requestData(`/blocks/${encodeURIComponent(head.hash)}/overview`)
assert(Array.isArray(overview.txids) && overview.txids.length > 0, 'head block overview returned no txids')
const txid = overview.txids[0]
const transaction = await requestData(`/txs/${encodeURIComponent(txid)}/lookup`)
assert(Array.isArray(transaction.outputs) && transaction.outputs.length > 0, 'sample transaction returned no outputs')
const address = transaction.outputs[0].address
assert(typeof address === 'string' && address.length > 0, 'sample output address is missing')
const encodedAddress = encodeURIComponent(address)
const addressActivity = await requestData(`/address/${encodedAddress}/activity?limit=100&offset=0`)

const blockPages = Math.max(1, Math.ceil((Number(blockPage.total) || blockPage.blocks.length) / 100))
const txPages = Math.max(1, Math.ceil((Number(txActivity.total) || txActivity.transactions.length || 1) / 100))
const addressPages = Math.max(1, Math.ceil((Number(addressActivity.total) || addressActivity.activity?.length || 1) / 100))

let endpointSequence = 0
const endpointFactories = [
  {
    name: 'blocks_page',
    path: () => `/blocks/page?limit=100&offset=${(endpointSequence % blockPages) * 100}`,
  },
  {
    name: 'transaction_activity',
    path: () => `/txs/activity?limit=100&offset=${(endpointSequence % txPages) * 100}`,
  },
  {
    name: 'block_overview',
    path: () => `/blocks/${encodeURIComponent(head.hash)}/overview`,
  },
  {
    name: 'block_transactions',
    path: () => `/blocks/${encodeURIComponent(head.hash)}/transactions?limit=100&offset=0`,
  },
  {
    name: 'transaction_lookup',
    path: () => `/txs/${encodeURIComponent(txid)}/lookup`,
  },
  {
    name: 'address_summary',
    path: () => `/address/${encodedAddress}/summary`,
  },
  {
    name: 'address_activity',
    path: () => `/address/${encodedAddress}/activity?limit=100&offset=${(endpointSequence % addressPages) * 100}`,
  },
  {
    name: 'search',
    path: () => `/search/${encodeURIComponent(endpointSequence % 2 === 0 ? head.hash : txid)}`,
  },
]

const startedAt = Date.now()
const deadline = startedAt + durationMs
let issued = 0
let succeeded = 0
let failed = 0
const latencies = []
const errors = new Map()
const perEndpoint = new Map(endpointFactories.map(({ name }) => [name, { issued: 0, succeeded: 0, failed: 0, latencies: [] }]))

async function measuredRequest(name, path) {
  const start = performance.now()
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    })
    const envelope = await response.json().catch(() => null)
    const ok = response.ok && envelope?.ok === true && envelope?.data !== null
    const latency = performance.now() - start
    latencies.push(latency)
    const bucket = perEndpoint.get(name)
    bucket.latencies.push(latency)
    if (ok) {
      succeeded += 1
      bucket.succeeded += 1
      return
    }
    failed += 1
    bucket.failed += 1
    const code = !response.ok ? `HTTP_${response.status}` : envelope?.error?.code || 'INVALID_ENVELOPE'
    errors.set(code, (errors.get(code) || 0) + 1)
  } catch (error) {
    const latency = performance.now() - start
    latencies.push(latency)
    const bucket = perEndpoint.get(name)
    bucket.latencies.push(latency)
    failed += 1
    bucket.failed += 1
    const code = error?.name === 'TimeoutError' ? 'TIMEOUT' : error?.name || 'REQUEST_ERROR'
    errors.set(code, (errors.get(code) || 0) + 1)
  }
}

async function worker() {
  while (Date.now() < deadline) {
    if (issued >= maxRequests) return
    const sequence = endpointSequence
    endpointSequence += 1
    const factory = endpointFactories[sequence % endpointFactories.length]
    const path = factory.path()
    issued += 1
    perEndpoint.get(factory.name).issued += 1
    await measuredRequest(factory.name, path)
    await sleep(workerDelayMs)
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()))

const elapsedMs = Math.max(1, Date.now() - startedAt)
const sortedLatencies = [...latencies].sort((a, b) => a - b)
const errorRate = issued === 0 ? 1 : failed / issued
const p95Ms = percentile(sortedLatencies, 95)
const endpointSummary = Object.fromEntries(
  [...perEndpoint.entries()].map(([name, stats]) => {
    const sorted = [...stats.latencies].sort((a, b) => a - b)
    return [name, {
      issued: stats.issued,
      succeeded: stats.succeeded,
      failed: stats.failed,
      p50_ms: Number(percentile(sorted, 50).toFixed(1)),
      p95_ms: Number(percentile(sorted, 95).toFixed(1)),
    }]
  }),
)

const result = {
  base_url: baseUrl,
  public_target: publicTarget,
  version: release.version,
  network_profile: release.network_profile,
  chain_id: release.chain_id,
  identity_pinned: Boolean(expectedReleaseMajor && expectedNetworkProfile && expectedChainId),
  contracts_enabled: status.contracts_enabled,
  duration_ms: elapsedMs,
  configured_duration_ms: durationMs,
  concurrency,
  target_rps: targetRps,
  max_requests: maxRequests,
  issued,
  succeeded,
  failed,
  error_rate: Number(errorRate.toFixed(6)),
  achieved_rps: Number(((issued * 1_000) / elapsedMs).toFixed(2)),
  latency_ms: {
    p50: Number(percentile(sortedLatencies, 50).toFixed(1)),
    p95: Number(p95Ms.toFixed(1)),
    p99: Number(percentile(sortedLatencies, 99).toFixed(1)),
    max: Number((sortedLatencies.at(-1) || 0).toFixed(1)),
  },
  errors: Object.fromEntries([...errors.entries()].sort()),
  endpoints: endpointSummary,
}

console.log(JSON.stringify(result, null, 2))

assert(issued > 0, 'load loop issued no requests')
assert(errorRate <= maxErrorRate, `error rate ${errorRate.toFixed(4)} exceeded limit ${maxErrorRate}`)
if (maxP95Ms !== null) {
  assert(p95Ms <= maxP95Ms, `p95 latency ${p95Ms.toFixed(1)}ms exceeded limit ${maxP95Ms}ms`)
}
