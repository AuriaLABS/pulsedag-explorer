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

const emptyActivity = response('/api/v1/address/genesis-treasury/activity?limit=20&offset=1')
assert(emptyActivity.address === 'genesis-treasury', 'activity page address must match the capture')
assert(emptyActivity.limit === 20 && emptyActivity.offset === 1, 'activity page coordinates are invalid')
assert(emptyActivity.count === 0 && emptyActivity.activity.length === 0, 'activity page after the only item must be empty')
assert(emptyActivity.total === 1, 'activity total must remain stable after the last item')
assert(emptyActivity.has_more === false, 'empty terminal activity page must not report more data')

console.log(`Validated ${Object.keys(fixture.responses).length} live-captured PulseDAG pagination boundaries.`)
