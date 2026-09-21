#!/usr/bin/env bash
# make remote — build Phaser via serve:game, Cloudflare tunnel, print play URL.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ROOT_WEB_PORT="${ROOT_WEB_PORT:-3000}"
WEB_PID=""
TUNNEL_PID=""
TUNNEL_LOG=""

port_open() {
  nc -z 127.0.0.1 "$1" >/dev/null 2>&1
}

wait_port() {
  local port="$1"
  local tries="${2:-180}"
  local i=0
  while [ "$i" -lt "$tries" ]; do
    if port_open "$port"; then
      return 0
    fi
    i=$((i + 1))
    sleep 0.5
  done
  echo "Timeout waiting for :$port" >&2
  return 1
}

kill_port() {
  local pids
  pids="$(lsof -ti "tcp:${1}" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
  fi
}

cleanup() {
  trap - EXIT INT TERM
  echo ""
  echo "Stopping…"
  [ -n "$TUNNEL_PID" ] && kill "$TUNNEL_PID" 2>/dev/null || true
  [ -n "$WEB_PID" ] && kill "$WEB_PID" 2>/dev/null || true
  kill_port "$ROOT_WEB_PORT"
  [ -n "$TUNNEL_LOG" ] && rm -f "$TUNNEL_LOG"
}

print_url() {
  echo ""
  echo "============================================================"
  echo "  GAME URL (leave API base empty):"
  echo "  $1"
  echo "============================================================"
  echo ""
}

trap cleanup EXIT INT TERM

command -v cloudflared >/dev/null 2>&1 || {
  echo "cloudflared missing. Install: brew install cloudflared" >&2
  exit 1
}

if port_open "$ROOT_WEB_PORT"; then
  echo "Port :$ROOT_WEB_PORT in use. Free it, then retry." >&2
  exit 1
fi

echo "→ pnpm serve:game (build Phaser + web :${ROOT_WEB_PORT})"
pnpm serve:game &
WEB_PID=$!
wait_port "$ROOT_WEB_PORT"

echo "→ Cloudflare tunnel"
TUNNEL_LOG="$(mktemp -t root-tunnel.XXXXXX)"
cloudflared tunnel --url "http://127.0.0.1:${ROOT_WEB_PORT}" >"$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

url=""
i=0
while [ "$i" -lt 90 ]; do
  if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
    echo "cloudflared exited early:" >&2
    cat "$TUNNEL_LOG" >&2 || true
    exit 1
  fi
  url="$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1 || true)"
  if [ -n "$url" ]; then
    print_url "$url"
    echo "(Ctrl+C stops everything)"
    wait "$TUNNEL_PID"
    exit 0
  fi
  i=$((i + 1))
  sleep 0.5
done

echo "Timed out waiting for tunnel URL. Log:" >&2
cat "$TUNNEL_LOG" >&2 || true
exit 1
