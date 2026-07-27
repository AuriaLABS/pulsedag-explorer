import { readFileSync } from 'node:fs'

const fixturePath = new URL('../fixtures/rpc/v2.3.0-pagination.json', import.meta.url)
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))

function fail(message) {
  throw new Error(`Pagination fixture validation failed: ${message}`)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function response(endpoint) {
  const envelope = fixture.responses[endpoint]
  assert(envelope && typeof envelope === 'object', `${endpoint} response is missing`)
  assert(envelope.ok === true, `${endpoint} must return ok=true`)
  assert(envelope.error === null, `${endpoint} must return error=null`)
  assert(envelope.data && typeof envelope.data === 'object', `${endpoint}.data is required`)
  assert(envelope.meta && typeof envelope.meta === 'object', `${endpoint}.meta is required`)
  return envelope.data
}

const expectedCapture = {
  candidate_sha: '7e43225f01ac05d15e5f1e3f1550d7850bf18cbc',
  workflow_run: 29854712585,
  artifact_id: 8505066594,
  artifact_digest: 'sha256:f52c848ff3c6476fe5496ee1bbabcb9bc41eadaed4668c96a0d81c5fefc7e92f',
  network: 'dev',
}

assert(fixture.release_line === 'v2.3.0', 'release_line must be v2.3.0')
assert(fixture.stable_prefix === '/api/v1', 'stable_prefix must be /api/v1')
assert(fixture.capture && typeof fixture.capture === 'object', 'capture provenance is required')
for (const [field, expected] of Object.entries(expectedCapture)) {
  assert(fixture.capture[field] === expected, `capture.${field} must match the approved artifact`)
}
assert(!Number.isNaN(Date.parse(fixture.capture.captured_at_utc)), 'capture timestamp must be valid')
assert(fixture.capture.scope.includes('mempool'), 'capture scope must include mempool pagination')
assert(fixture.capture.scope.includes('transaction activity'), 'capture scope must include global transaction activity')

const firstBlocks = response('/api/v1/blocks/page?limit=20&offset=0')
assert(firstBlocks.limit === 20 && firstBlocks.offset === 0, 'first block page coordinates are invalid')
assert(firstBlocks.count === firstBlocks.blocks.length, 'first block page count must match blocks length')
assert(firstBlocks.total >= firstBlocks.count, 'first block page total must cover count')
assert(firstBlocks.blocks.length === 1, 'isolated capture must contain the genesis block')
assert(firstBlocks.blocks[0].hash === '0828edfca48b1a43e407c4d9d7f63650552d9b86587f2565eba0c05977484047', 'first block page must contain the captured genesis block')
assert(firstBlocks.has_more === false, 'single-block capture must not report another page')

const emptyBlocks = response('/api/v1/blocks/page?limit=20&offset=20')
assert(emptyBlocks.limit === 20 && emptyBlocks.offset === 20, 'empty block page coordinates are invalid')
assert(emptyBlocks.count === 0 && emptyBlocks.blocks.length === 0, 'out-of-range block page must be empty')
assert(emptyBlocks.total === firstBlocks.total, 'block page total must remain stable across offsets')
assert(emptyBlocks.has_more === false, 'out-of-range block page must not report more data')

const emptyAddressActivity = response('/api/v1/address/genesis-treasury/activity?limit=20&offset=1')
assert(emptyAddressActivity.address === 'genesis-treasury', 'activity page address must match the capture')
assert(emptyAddressActivity.limit === 20 && emptyAddressActivity.offset === 1, 'activity page coordinates are invalid')
assert(emptyAddressActivity.count === 0 && emptyAddressActivity.activity.length === 0, 'activity page after the only item must be empty')
assert(emptyAddressActivity.total === 1, 'activity total must remain stable after the last item')
assert(emptyAddressActivity.has_more === false, 'empty terminal activity page must not report more data')

const mempoolPage = response('/api/v1/txs/page?limit=20&offset=0')
assert(mempoolPage.limit === 20 && mempoolPage.offset === 0, 'mempool page coordinates are invalid')
assert(Array.isArray(mempoolPage.transactions), 'mempool page transactions must be an array')
assert(mempoolPage.count === mempoolPage.transactions.length, 'mempool page count must match transactions length')
assert(mempoolPage.total >= mempoolPage.count, 'mempool total must cover page count')
assert(mempoolPage.count === 0 && mempoolPage.total === 0, 'isolated capture must have an empty mempool')
assert(mempoolPage.has_more === false, 'empty mempool page must not report more data')

const firstTransactionActivity = response('/api/v1/txs/activity?limit=20&offset=0')
assert(firstTransactionActivity.limit === 20 && firstTransactionActivity.offset === 0, 'first transaction activity coordinates are invalid')
assert(firstTransactionActivity.count === firstTransactionActivity.transactions.length, 'transaction activity count must match transactions length')
assert(firstTransactionActivity.total === 1, 'isolated transaction activity must contain the genesis transaction')
assert(firstTransactionActivity.has_more === false, 'single transaction activity page must not report more data')
const genesisTransaction = firstTransactionActivity.transactions[0]
assert(genesisTransaction.txid === 'bfab773bc5ccf4326249fc6951f4dd3eccca2918ec4e063b0ee767a22c557f08', 'transaction activity must contain the captured genesis transaction')
assert(genesisTransaction.context === 'confirmed' && genesisTransaction.is_confirmed === true, 'genesis activity must be confirmed')
assert(genesisTransaction.is_mempool === false, 'genesis activity must not be in the mempool')
assert(genesisTransaction.block_hash === firstBlocks.blocks[0].hash && genesisTransaction.block_height === 0, 'genesis activity must link to the genesis block')

const terminalTransactionActivity = response('/api/v1/txs/activity?limit=20&offset=20')
assert(terminalTransactionActivity.limit === 20 && terminalTransactionActivity.offset === 20, 'terminal transaction activity coordinates are invalid')
assert(terminalTransactionActivity.count === 0 && terminalTransactionActivity.transactions.length === 0, 'terminal transaction activity page must be empty')
assert(terminalTransactionActivity.total === firstTransactionActivity.total, 'transaction activity total must remain stable across offsets')
assert(terminalTransactionActivity.has_more === false, 'terminal transaction activity must not report more data')

console.log(`Validated ${Object.keys(fixture.responses).length} live-captured PulseDAG pagination boundaries.`)
