import { readFileSync } from 'node:fs'

const configPath = new URL('../deploy/nginx/pulsedag-explorer.conf', import.meta.url)
const config = readFileSync(configPath, 'utf8')

function fail(message) {
  throw new Error(`Proxy validation failed: ${message}`)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

const expectedProxyTargets = new Set([
  '/api/v1/status',
  '/api/v1/blocks/recent',
  '/api/v1/blocks/page$is_args$args',
  '/api/v1/blocks/$1/overview',
  '/api/v1/sync/status',
  '/api/v1/mempool',
  '/api/v1/pow/health',
  '/api/v1/txs/$1/lookup',
  '/api/v1/address/$1/summary',
  '/api/v1/address/$1/activity$is_args$args',
  '/api/v1/search/$1'
])

const proxyTargets = [...config.matchAll(/proxy_pass\s+http:\/\/pulsedag_rpc([^;]*);/g)].map((match) => match[1])
assert(proxyTargets.length === expectedProxyTargets.size, `expected ${expectedProxyTargets.size} proxy targets, found ${proxyTargets.length}`)

for (const target of proxyTargets) {
  assert(expectedProxyTargets.has(target), `unexpected proxied RPC target: ${target || '<root>'}`)
}
for (const target of expectedProxyTargets) {
  assert(proxyTargets.includes(target), `missing proxied RPC target: ${target}`)
}

const forbiddenFragments = [
  '/admin',
  '/wallet',
  '/mine',
  '/mining',
  '/tx/submit',
  '/tx/build',
  '/snapshot/create',
  '/prune',
  '/sync/rebuild',
  '/sync/reconcile-mempool'
]
for (const fragment of forbiddenFragments) {
  assert(!proxyTargets.some((target) => target.includes(fragment)), `write or operator route is exposed: ${fragment}`)
}

assert(config.includes('location = /rpc/api/v1/blocks/page'), 'block pagination must use an exact route')
assert(config.includes('/blocks/page$is_args$args'), 'block pagination query parameters must be preserved')
assert(config.includes('location ~ ^/rpc/api/v1/txs/([0-9A-Fa-f]{16,128})/lookup$'), 'transaction lookup must require a bounded hexadecimal txid')
assert(config.includes('location ~ ^/rpc/api/v1/address/([A-Za-z0-9._:-]{1,256})/summary$'), 'address summary must use a bounded safe path alphabet')
assert(config.includes('location ~ ^/rpc/api/v1/address/([A-Za-z0-9._:-]{1,256})/activity$'), 'address activity must use a bounded safe path alphabet')
assert(config.includes('/activity$is_args$args'), 'address activity query pagination must be preserved')
assert(config.includes('location ^~ /rpc/'), 'catch-all /rpc/ location is required')
assert(/location \^~ \/rpc\/\s*\{\s*return 404;/m.test(config), 'unknown RPC routes must return 404')
assert(!config.includes('proxy_pass http://pulsedag_rpc;'), 'broad upstream proxying is forbidden')
assert(config.includes('frame-ancestors \'none\''), 'CSP frame-ancestors protection is required')
assert(config.includes('X-Content-Type-Options "nosniff"'), 'nosniff header is required')
assert(config.includes('Referrer-Policy "no-referrer"'), 'no-referrer policy is required')
assert(config.includes('Permissions-Policy'), 'Permissions-Policy header is required')
assert(config.includes('proxy_connect_timeout 2s'), 'bounded connect timeout is required')
assert(config.includes('proxy_read_timeout 5s'), 'bounded read timeout is required')

console.log(`Validated ${proxyTargets.length} read-only PulseDAG RPC proxy routes and deny-by-default fallback.`)
