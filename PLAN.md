### Goal
- One command: build Phaser → serve from `@root/web` (same origin).
- One command: build Phaser → Capacitor iOS app (simulator / Xcode).
- Dev split (`dev:web` + `dev:phaser`) stay unchanged.
- iOS = thin WebView client only; authoritative game still on `@root/web` (enter LAN API URL in menu).

### Approach
- Static root: `backend/web/public` (gitignored). Script copies Vite `dist` there.
- API/WS routes first; `serveStatic` last.
- Move service JSON `/` → `/health`. `/` = Phaser `index.html`.
- Capacitor wrap Vite `dist/` → native `frontend/phaser/ios/`.
- iOS script: vite build → cap sync → open Xcode. Cleartext ATS for LAN HTTP.

### Files to change
- `backend/web/src/openapi.ts`: `/` → `/health`
- `backend/web/src/static.ts`: serveStatic mount
- `backend/web/src/index.ts`: wire static; log game URL
- `backend/web/scripts/serve-phaser.ts`: build → copy → start
- `backend/web/package.json`, `backend/web/.gitignore`
- `frontend/phaser/package.json`: Capacitor deps + `build:ios`
- `frontend/phaser/capacitor.config.ts`
- `frontend/phaser/scripts/build-ios.ts`
- `frontend/phaser/ios/`: generated native project + ATS
- `package.json`: `serve:game`, `build:ios`
- `frontend/phaser/README.md`: web serve + iOS howto

### Test plan
- `pnpm serve:game` → `http://localhost:3000/` loads menu; `/health` JSON; `/game` + WS work.
- `pnpm build:ios` → Xcode opens → Simulator; set API base to LAN host; Join works.

### Commit plan
- `feat(web): serve phaser static at /`
  - `backend/web/src/openapi.ts`
  - `backend/web/src/static.ts`
  - `backend/web/src/index.ts`
  - `backend/web/.gitignore`
- `feat(web): add serve-phaser build script`
  - `backend/web/scripts/serve-phaser.ts`
  - `backend/web/package.json`
  - `package.json` (`serve:game`)
- `feat(phaser): add Capacitor iOS scaffold`
  - `frontend/phaser/package.json`
  - `frontend/phaser/capacitor.config.ts`
  - `frontend/phaser/ios/`
- `feat(phaser): add build-ios script`
  - `frontend/phaser/scripts/build-ios.ts`
  - `frontend/phaser/package.json`
  - `package.json` (`build:ios`)
- `docs(phaser): web serve and iOS howto`
  - `frontend/phaser/README.md`
