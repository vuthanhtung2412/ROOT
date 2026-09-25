import { useSyncExternalStore, type JSX } from 'react'
import { getHudSnapshot, patchHud, subscribeHud } from '#game/hudStore.ts'

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
    <div
      className="pointer-events-none fixed inset-0 z-[500] flex flex-col items-center justify-center gap-4 bg-forest-deep"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <p className="m-0 font-display text-2xl tracking-[0.04em] text-parchment [text-shadow:1px_1px_0_color-mix(in_srgb,var(--color-ink)_55%,transparent)]">
        Loading…
      </p>
      <div className="box-border h-7 w-80 border-2 border-ink bg-[color-mix(in_srgb,var(--color-parchment)_18%,var(--color-forest-deep))] p-[5px] [background-blend-mode:multiply] [background-image:var(--root-paper-grain)] shadow-[inset_0_0_0_1px_var(--color-parchment-shadow)]">
        <div
          className="h-full border border-ink-soft bg-[linear-gradient(90deg,var(--color-gold),color-mix(in_srgb,var(--color-parchment)_70%,var(--color-gold)))]"
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
