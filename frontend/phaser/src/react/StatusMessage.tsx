import { useSyncExternalStore, type JSX } from 'react'
import { getHudSnapshot, patchHud, subscribeHud } from '#game/hudStore.ts'
import '#react/StatusMessage.css'

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
    <p className="status-message" role="status">
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
