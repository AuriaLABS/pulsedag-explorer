import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function fail(message) {
  throw new Error(`v3 readiness validation failed: ${message}`)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

const env = read('.env.example')
const api = read('src/lib/api.ts')
const app = read('src/App.tsx')
const nginx = read('deploy/nginx/pulsedag-explorer.conf')
const docs = read('docs/V3_MAINNET_READINESS.md')

for (const key of [
  'VITE_EXPECTED_RELEASE_MAJOR',
  'VITE_EXPECTED_NETWORK_PROFILE',
  'VITE_EXPECTED_CHAIN_ID',
]) {
  const match = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
  assert(match, `.env.example is missing ${key}`)
  assert(match[1].trim() === '', `${key} must stay blank in the repository until the upstream identity freeze`)
}

assert(
  /^VITE_REQUIRE_CONTRACTS_DISABLED=true$/m.test(env),
  'v3.0 must default to fail closed with smart contracts disabled',
)

for (const fragment of [
  "request<ReleaseInfoData>('/release')",
  'NETWORK_IDENTITY_MISMATCH',
  'RELEASE_IDENTITY_MISMATCH',
  'RELEASE_MAJOR_MISMATCH',
  'NETWORK_PROFILE_MISMATCH',
  'CHAIN_ID_MISMATCH',
  'CONTRACTS_NOT_DISABLED',
  "release.capabilities.includes('explorer_api')",
  "release.capabilities.includes('contracts_disabled')",
  'status.contracts_enabled !== false',
]) {
  assert(api.includes(fragment), `API identity guard is missing: ${fragment}`)
}

assert(
  nginx.includes('location = /rpc/api/v1/release'),
  'production gateway must expose exact read-only /api/v1/release',
)
assert(
  /location \/rpc\/\s*\{\s*return 404;/m.test(nginx),
  'production gateway must keep deny-by-default RPC fallback',
)
assert(
  !nginx.includes('location ^~ /rpc/'),
  'deny-by-default RPC fallback must not shadow regex allowlist routes with ^~',
)

for (const fragment of [
  'const liveIdentityReady = !explorerApi.isLiveMode || snapshot !== null',
  'if (explorerApi.isLiveMode) setSnapshot(null)',
  'liveIdentityReady && isEntityRoute',
  "setSearchMessage('Network identity is not verified yet.')",
]) {
  assert(app.includes(fragment), `live UI identity gate is missing: ${fragment}`)
}

for (const fragment of [
  'PulseDAG #1049',
  'must not hard-code guessed values',
  'VITE_EXPECTED_RELEASE_MAJOR=3',
  'VITE_REQUIRE_CONTRACTS_DISABLED=true',
]) {
  assert(docs.includes(fragment), `v3 readiness documentation is missing: ${fragment}`)
}

console.log('Validated PulseDAG v3/mainnet explorer fail-closed readiness policy.')
