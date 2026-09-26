#!/usr/bin/env bash
set -euo pipefail

if [[ ! -d dist ]]; then
  echo "dist/ is missing; run npm run build first" >&2
  exit 1
fi

source_sha="${PULSEDAG_SOURCE_SHA:-${GITHUB_SHA:-}}"
if [[ -z "$source_sha" ]]; then
  source_sha="$(git rev-parse HEAD)"
fi
if [[ ! "$source_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "invalid source SHA: $source_sha" >&2
  exit 1
fi

workflow_sha="${GITHUB_SHA:-$source_sha}"
if [[ ! "$workflow_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "invalid workflow SHA: $workflow_sha" >&2
  exit 1
fi

out_dir="artifacts"
archive="$out_dir/pulsedag-explorer-$source_sha.tar.gz"
checksum="$archive.sha256"
provenance="$out_dir/pulsedag-explorer-$source_sha.provenance.txt"

rm -rf "$out_dir"
mkdir -p "$out_dir"

tar \
  --sort=name \
  --mtime='UTC 1970-01-01' \
  --owner=0 \
  --group=0 \
  --numeric-owner \
  -C dist \
  -cf - . | gzip -n > "$archive"

(
  cd "$out_dir"
  sha256sum "$(basename "$archive")" > "$(basename "$checksum")"
)

{
  printf 'repository=%s\n' "${GITHUB_REPOSITORY:-AuriaLABS/pulsedag-explorer}"
  printf 'commit_sha=%s\n' "$commit_sha"
  printf 'workflow_run_id=%s\n' "${GITHUB_RUN_ID:-local}"
  printf 'workflow_run_attempt=%s\n' "${GITHUB_RUN_ATTEMPT:-local}"
  printf 'node_version=%s\n' "$(node --version)"
  printf 'npm_version=%s\n' "$(npm --version)"
  printf 'archive=%s\n' "$(basename "$archive")"
  printf 'sha256=%s\n' "$(cut -d' ' -f1 "$checksum")"
} > "$provenance"

echo "Created $archive"
echo "Created $checksum"
echo "Created $provenance"
