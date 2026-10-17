#!/usr/bin/env bash
# Publish the checked-out frontend to GitHub Pages: bash scripts/sync-pages.sh <api-url>
# Started by `pnpm remote:pages` (scripts/remote-play.sh) once the Funnel is up.
# 1. Waits until <api-url> answers.
# 2. Builds the local checkout (any commit) with ROOT_WEB_API=<api-url>.
# 3. Pushes the build to the `gh-pages` branch (single commit, no history).
# 4. Points GitHub Pages at that branch if it is not already.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

API_URL="${1:?usage: sync-pages.sh <api-url>}"
PAGES_BRANCH="gh-pages"
REACT_DIST_DIRECTORY="frontend/react/dist"
BACKEND_POLL_ATTEMPTS=180
BACKEND_POLL_INTERVAL_SECONDS=2
LFS_POINTER_SIGNATURE="version https://git-lfs.github.com/spec"

echo "[pages] waiting for backend at ${API_URL}"
backend_up=""
for _ in $(seq 1 "$BACKEND_POLL_ATTEMPTS"); do
  curl -sf -o /dev/null "$API_URL" && backend_up="yes" && break
  sleep "$BACKEND_POLL_INTERVAL_SECONDS"
done
[ -n "$backend_up" ] || {
  echo "[pages] backend never answered at ${API_URL}" >&2
  exit 1
}

repository_name="$(gh repo view --json name --jq .name)"
commit="$(git rev-parse --short HEAD)"
[ -z "$(git status --porcelain)" ] || commit="${commit}-dirty"

# Art (.glb) lives in Git LFS; without a pull the build ships pointer files.
git lfs pull

echo "[pages] building ${commit} for /${repository_name}/"
ROOT_WEB_BASE_PATH="/${repository_name}/" ROOT_WEB_API="$API_URL" pnpm build:react

lfs_pointer_files="$(grep -rlI "$LFS_POINTER_SIGNATURE" "$REACT_DIST_DIRECTORY" || true)"
[ -z "$lfs_pointer_files" ] || {
  echo "[pages] Git LFS pointers in build (run git lfs pull):" >&2
  echo "$lfs_pointer_files" >&2
  exit 1
}

# --no-history re-creates the branch as an orphan; a cached clone from a
# previous run already has it checked out, so drop the cache first.
pnpm exec gh-pages-clean
pnpm exec gh-pages --dist "$REACT_DIST_DIRECTORY" --branch "$PAGES_BRANCH" \
  --nojekyll --no-history --message "deploy ${commit} (api ${API_URL})"
echo "[pages] pushed ${commit} to ${PAGES_BRANCH}"

# Pages needs a public repo on the free plan; serve it from the branch root.
build_type="$(gh api "repos/{owner}/{repo}/pages" --jq .build_type 2>/dev/null || true)"
if [ -z "$build_type" ]; then
  gh api -X POST "repos/{owner}/{repo}/pages" -f build_type=legacy \
    -f "source[branch]=${PAGES_BRANCH}" -f "source[path]=/" >/dev/null
  echo "[pages] GitHub Pages enabled (source: ${PAGES_BRANCH})"
elif [ "$build_type" != "legacy" ]; then
  gh api -X PUT "repos/{owner}/{repo}/pages" -f build_type=legacy \
    -f "source[branch]=${PAGES_BRANCH}" -f "source[path]=/" >/dev/null
  echo "[pages] GitHub Pages source switched to ${PAGES_BRANCH}"
fi
