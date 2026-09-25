import { useSyncExternalStore, type JSX } from 'react'
import { getHudSnapshot, patchHud, subscribeHud } from '#game/hudStore.ts'
import '#react/BootOverlay.css'

export function BootOverlay(): JSX.Element | null {
  const shell = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().shell,
    () => getHudSnapshot().shell,
  )
  const boot = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().bootLoading,
    () => getHudSnapshot().bootLoading,
  )
  if (shell !== 'boot' || boot === null) {
    return null
  }
  const clamped = Math.max(0, Math.min(1, boot.progress))
  return (
    <div className="boot-overlay" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped * 100)}>
      <p className="boot-overlay__label">Loading…</p>
      <div className="boot-overlay__track">
        <div
          className="boot-overlay__fill"
          style={{ width: `${String(clamped * 100)}%` }}
        />
      </div>
    </div>
  )
}

export function syncBootLoading(progress: number): void {
  patchHud({
    shell: 'boot',
    bootLoading: { progress },
  })
}

export function clearBootLoading(): void {
  patchHud({
    bootLoading: null,
  })
}
