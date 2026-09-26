import { readFileSync } from 'node:fs'

const pack = readFileSync(new URL('./package-build-artifact.sh', import.meta.url), 'utf8')
const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')

function fail(message) {
  throw new Error(`Build artifact validation failed: ${message}`)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

for (const fragment of [
  "--sort=name",
  "--mtime='UTC 1970-01-01'",
  "--owner=0",
  "--group=0",
  "--numeric-owner",
  "-C dist",
  "gzip -n",
  "sha256sum",
  "provenance.txt",
  "commit_sha=",
  "workflow_run_id=",
]) {
  assert(pack.includes(fragment), `artifact packager is missing: ${fragment}`)
}

for (const forbidden of [
  ".env",
  "node_modules",
  ".git/",
  "PULSEDAG_RPC_TARGET",
]) {
  assert(!pack.includes(`-C ${forbidden}`), `artifact packager must not archive ${forbidden}`)
}

assert(
  ci.includes('uses: actions/upload-artifact@v4'),
  'CI must upload the checksummed build bundle',
)
for (const glob of [
  'artifacts/*.tar.gz',
  'artifacts/*.sha256',
  'artifacts/*.provenance.txt',
]) {
  assert(ci.includes(glob), `CI artifact upload is missing ${glob}`)
}
assert(ci.includes('if-no-files-found: error'), 'CI artifact upload must fail if packaging produced no files')

console.log('Validated deterministic dist-only archive policy, SHA-256 manifest, provenance, and CI upload.')
