#!/usr/bin/env bash
# pnpm remote:cloudflare — serve:game + Cloudflare quick tunnel → random public URL
# No account needed. URL changes on every run (unlike `pnpm remote`).
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PORT="${ROOT_WEB_PORT:-3000}"
TUNNEL_URL_PATTERN='https://[a-z0-9-]+\.trycloudflare\.com'
TUNNEL_READY_MARKER='Registered tunnel connection'
TUNNEL_DNS_SETTLE_SECONDS=5
TUNNEL_LOG="$(mktemp -t root-cloudflare-tunnel)"
WEB_PID=""
TUNNEL_PID=""

cleanup() {
  trap - EXIT INT TERM
  echo ""
  echo "Stopping…"
  [ -n "$TUNNEL_PID" ] && kill "$TUNNEL_PID" 2>/dev/null || true
  [ -n "$WEB_PID" ] && kill "$WEB_PID" 2>/dev/null || true
  pids="$(lsof -ti "tcp:${PORT}" 2>/dev/null || true)"
  # shellcheck disable=SC2086
  [ -n "$pids" ] && kill $pids 2>/dev/null || true
  rm -f "$TUNNEL_LOG"
}
trap cleanup EXIT INT TERM

command -v cloudflared >/dev/null || {
  echo "Install cloudflared: brew install cloudflared" >&2
  exit 1
}

echo "→ pnpm serve:game :${PORT}"
pnpm serve:game &
WEB_PID=$!
for _ in $(seq 1 180); do
  nc -z 127.0.0.1 "$PORT" >/dev/null 2>&1 && break
  sleep 0.5
done
nc -z 127.0.0.1 "$PORT" >/dev/null 2>&1 || {
  echo "Timeout waiting for :$PORT" >&2
  exit 1
}

echo "→ cloudflared tunnel → :${PORT}"
cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:${PORT}" \
  >"$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

url=""
for _ in $(seq 1 60); do
  url="$(grep -Eo "$TUNNEL_URL_PATTERN" "$TUNNEL_LOG" | head -1 || true)"
  [ -n "$url" ] && break
  kill -0 "$TUNNEL_PID" 2>/dev/null || break
  sleep 0.5
done
[ -n "$url" ] || {
  echo "cloudflared did not give a URL:" >&2
  cat "$TUNNEL_LOG" >&2
  exit 1
}

# Opening the URL before its DNS exists makes resolvers cache the miss.
echo "→ waiting for tunnel DNS"
for _ in $(seq 1 60); do
  grep -q "$TUNNEL_READY_MARKER" "$TUNNEL_LOG" && break
  sleep 0.5
done
sleep "$TUNNEL_DNS_SETTLE_SECONDS"

echo ""
echo "============================================================"
echo "  GAME URL (leave API base empty):"
echo "  ${url}"
echo "============================================================"
echo ""
echo "(Ctrl+C stops everything)"
wait "$WEB_PID"
