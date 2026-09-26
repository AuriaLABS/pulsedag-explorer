#!/usr/bin/env bash
set -euo pipefail

if ! command -v nginx >/dev/null 2>&1; then
  echo "nginx is required for runtime routing validation" >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required for the local test upstream" >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for runtime routing validation" >&2
  exit 1
fi

tmpdir="$(mktemp -d)"
backend_pid=""
cleanup() {
  nginx -p "$tmpdir/" -c "$tmpdir/nginx.conf" -s stop >/dev/null 2>&1 || true
  if [[ -n "$backend_pid" ]]; then
    kill "$backend_pid" >/dev/null 2>&1 || true
    wait "$backend_pid" 2>/dev/null || true
  fi
  rm -rf "$tmpdir"
}
trap cleanup EXIT

mkdir -p "$tmpdir/html" "$tmpdir/logs"
printf '<!doctype html><title>PulseDAG explorer routing test</title>\n' > "$tmpdir/html/index.html"

sed \
  -e 's/server pulsedagd:8080;/server 127.0.0.1:18081;/' \
  -e 's/listen 8080;/listen 18080;/' \
  -e "s#root /usr/share/nginx/html;#root $tmpdir/html;#" \
  deploy/nginx/pulsedag-explorer.conf > "$tmpdir/site.conf"

cat > "$tmpdir/nginx.conf" <<EOF
pid $tmpdir/nginx.pid;
error_log $tmpdir/error.log notice;
events {}
http {
    access_log $tmpdir/access.log;
    include $tmpdir/site.conf;
}
EOF

python3 - <<'PY' &
from http.server import BaseHTTPRequestHandler, HTTPServer

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(204)
        self.end_headers()

    def log_message(self, *_args):
        pass

HTTPServer(("127.0.0.1", 18081), Handler).serve_forever()
PY
backend_pid="$!"

nginx -p "$tmpdir/" -c "$tmpdir/nginx.conf" -t
nginx -p "$tmpdir/" -c "$tmpdir/nginx.conf"

for _ in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:18080/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

assert_status() {
  local expected="$1"
  local path="$2"
  local actual
  actual="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:18080$path")"
  if [[ "$actual" != "$expected" ]]; then
    echo "expected HTTP $expected for $path, got $actual" >&2
    exit 1
  fi
}

hash="0123456789abcdef"
assert_status 204 "/rpc/api/v1/blocks/$hash/overview"
assert_status 204 "/rpc/api/v1/blocks/$hash/transactions?limit=20&offset=0"
assert_status 204 "/rpc/api/v1/txs/$hash/lookup"
assert_status 204 "/rpc/api/v1/address/PULSE_test:abc/summary"
assert_status 204 "/rpc/api/v1/address/PULSE_test:abc/activity?limit=20&offset=0"
assert_status 204 "/rpc/api/v1/search/$hash"

assert_status 404 "/rpc/api/v1/blocks/short/overview"
assert_status 404 "/rpc/api/v1/admin"
assert_status 404 "/rpc/api/v1/tx/submit"

echo "Validated nginx syntax, reachable regex allowlist routes, and deny-by-default RPC fallback."
