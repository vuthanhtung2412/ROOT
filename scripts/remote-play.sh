#!/usr/bin/env bash
# pnpm remote (process-compose.remote.yaml) — build + serve + Tailscale Funnel → stable URL
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PORT="${ROOT_WEB_PORT:-3000}"
# Funnel HTTPS listen (443 often taken by Docker). Allowed: 443, 8443, 10000.
HTTPS_PORT="${FUNNEL_HTTPS_PORT:-8443}"
WEB_PID=""

cleanup() {
  trap - EXIT INT TERM
  echo ""
  echo "Stopping…"
  tailscale funnel --https="$HTTPS_PORT" --yes off >/dev/null 2>&1 || true
  [ -n "$WEB_PID" ] && kill "$WEB_PID" 2>/dev/null || true
  pids="$(lsof -ti "tcp:${PORT}" 2>/dev/null || true)"
  # shellcheck disable=SC2086
  [ -n "$pids" ] && kill $pids 2>/dev/null || true
}
trap cleanup EXIT INT TERM

command -v tailscale >/dev/null || {
  echo "Install Tailscale.app" >&2
  exit 1
}
tailscale status >/dev/null || {
  echo "Open Tailscale.app and sign in" >&2
  exit 1
}

echo "→ pnpm --filter @root/web serve:react :${PORT}"
pnpm --filter @root/web serve:react &
WEB_PID=$!
for _ in $(seq 1 180); do
  nc -z 127.0.0.1 "$PORT" >/dev/null 2>&1 && break
  sleep 0.5
done
nc -z 127.0.0.1 "$PORT" >/dev/null 2>&1 || {
  echo "Timeout waiting for :$PORT" >&2
  exit 1
}

echo "→ funnel --https=${HTTPS_PORT}"
tailscale funnel --bg --yes --https="$HTTPS_PORT" "$PORT"

dns="$(tailscale status --json | node -e '
  let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>{
    const n=JSON.parse(s).Self.DNSName.replace(/\.$/,"");
    process.stdout.write(n);
  });
')"
url="https://${dns}"
[ "$HTTPS_PORT" != "443" ] && url="${url}:${HTTPS_PORT}"

echo ""
echo "============================================================"
echo "  GAME URL (leave API base empty):"
echo "  ${url}"
echo "============================================================"
echo ""
echo "(Ctrl+C stops everything)"

# pnpm remote:pages — build this checkout against this URL, publish it to GitHub Pages.
[ "${ROOT_PAGES_SYNC:-}" = "1" ] && bash scripts/sync-pages.sh "$url" &

wait "$WEB_PID"
