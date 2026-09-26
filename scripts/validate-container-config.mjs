import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function fail(message) {
  throw new Error(`Container validation failed: ${message}`)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

const dockerfile = read('Dockerfile')
const dockerignore = read('.dockerignore')
const nginx = read('deploy/nginx/pulsedag-explorer.conf')

for (const fragment of [
  'FROM ${NODE_IMAGE} AS build',
  'FROM ${NGINX_IMAGE} AS runtime',
  'RUN npm run build',
  'COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html',
  'COPY --chown=nginx:nginx deploy/nginx/pulsedag-explorer.conf /etc/nginx/conf.d/default.conf',
  'USER nginx',
  'EXPOSE 8080',
  'http://127.0.0.1:8080/healthz',
]) {
  assert(dockerfile.includes(fragment), `Dockerfile is missing: ${fragment}`)
}

for (const key of [
  'VITE_EXPECTED_RELEASE_MAJOR',
  'VITE_EXPECTED_NETWORK_PROFILE',
  'VITE_EXPECTED_CHAIN_ID',
]) {
  assert(
    new RegExp(`^ARG ${key}=$`, 'm').test(dockerfile),
    `${key} must stay blank by default until the upstream identity freeze`,
  )
}

assert(
  /^ARG VITE_REQUIRE_CONTRACTS_DISABLED=true$/m.test(dockerfile),
  'production image build must default to contracts disabled',
)
assert(
  !dockerfile.includes('PULSEDAG_RPC_TARGET='),
  'runtime node target must not be embedded as a frontend build variable',
)

for (const fragment of ['.git', 'node_modules', 'dist', '.env']) {
  assert(dockerignore.split(/\r?\n/).includes(fragment), `.dockerignore must exclude ${fragment}`)
}

assert(
  /location = \/healthz\s*\{[\s\S]*?return 200 "ok\\n";[\s\S]*?\}/m.test(nginx),
  'nginx must expose an exact local liveness endpoint',
)
const healthLocation = nginx.match(/location = \/healthz\s*\{([\s\S]*?)\}/m)?.[1] || ''
assert(!healthLocation.includes('proxy_pass'), 'healthz must not proxy to pulsedagd')

console.log('Validated production container build, blank launch identity defaults, non-root runtime, and local liveness endpoint.')
