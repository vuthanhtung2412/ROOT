import { useSyncExternalStore, type JSX } from 'react'
import { getHudSnapshot, patchHud, subscribeHud } from '#game/hudStore.ts'

export function StatusMessage(): JSX.Element | null {
  const status = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().statusMessage,
    () => getHudSnapshot().statusMessage,
  )
  if (status === null || status.text.length === 0) {
    return null
  }
  return (
    <p
      className="root-panel pointer-events-none fixed bottom-[8%] left-1/2 z-[120] m-0 max-w-[min(52vw,520px)] -translate-x-1/2 px-3 py-1.5 text-center font-body text-[13px] text-ink italic portrait:bottom-28 portrait:max-w-[calc(100vw-24px)] portrait:text-xs"
      role="status"
    >
      {status.text}
    </p>
  )
}

export function syncStatusMessage(text: string | null | undefined): void {
  const nextText = text ?? ''
  const current = getHudSnapshot().statusMessage
  if (nextText.length === 0) {
    if (current === null) {
      return
    }
    patchHud({ statusMessage: null })
    return
  }
  if (current !== null && current.text === nextText) {
    return
  }
  patchHud({ statusMessage: { text: nextText } })
}
