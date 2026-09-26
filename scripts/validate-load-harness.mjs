import { readFileSync } from 'node:fs'

const harness = readFileSync(new URL('./load-live-rpc.mjs', import.meta.url), 'utf8')

function fail(message) {
  throw new Error(`Load harness validation failed: ${message}`)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

for (const fragment of [
  "PULSEDAG_LOAD_ALLOW_PUBLIC",
  "refusing a non-private target",
  "status.chain_id === release.chain_id",
  "status.version === release.version",
  "release.capabilities.includes('explorer_api')",
  "status.contracts_enabled === false",
  "release.capabilities.includes('contracts_disabled')",
  "PULSEDAG_LOAD_MAX_ERROR_RATE",
  "PULSEDAG_LOAD_MAX_P95_MS",
  "maxRequests",
  "targetRps",
  "concurrency",
]) {
  assert(harness.includes(fragment), `required safety or measurement guard is missing: ${fragment}`)
}

for (const forbidden of [
  "/admin",
  "/wallet",
  "/mine",
  "/mining",
  "/tx/submit",
  "/tx/build",
  "/snapshot/create",
  "/prune",
  "/sync/rebuild",
  "/sync/reconcile-mempool",
]) {
  assert(!harness.includes(`requestData('${forbidden}`), `forbidden mutation/operator route is used: ${forbidden}`)
  assert(!harness.includes(`fetch(\`${baseUrl}${forbidden}`), `forbidden mutation/operator route is used: ${forbidden}`)
}

assert(
  harness.includes("if (!['http:', 'https:'].includes(parsedBase.protocol))"),
  'load target protocol must be restricted to HTTP(S)',
)
assert(
  harness.includes("if (!parsedBase.pathname.endsWith('/api/v1'))"),
  'load target must be scoped to the stable /api/v1 namespace',
)

console.log('Validated bounded read-only load harness safety and identity preflight policy.')
