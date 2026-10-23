import { useState, type JSX } from 'react'
import { SECONDARY_BUTTON_CLASS_NAME } from '#react/MenuParts.tsx'

const ROOM_CODE_LABEL = 'Room code'
const COPY_LABEL = 'Copy'
const COPIED_LABEL = 'Copied'
/** How long "Copied" shows before the button reads "Copy" again. */
const COPIED_FEEDBACK_MILLISECONDS = 1500

const ROOM_CODE_ROW_CLASS_NAME =
  'root-paper root-paper-fine flex flex-row items-center gap-3 px-4 py-1.5'
const ROOM_CODE_CAPTION_CLASS_NAME = 'font-body text-sm text-ink-soft italic'
/** Wide letters: the host reads the code aloud or sends it in a chat. */
const ROOM_CODE_VALUE_CLASS_NAME =
  'font-display text-2xl tracking-[0.3em] text-ink-deep select-all'

/** Online lobby: the code guests type to join, with a copy button. */
export function LobbyRoomCode(props: { roomCode: string | null }): JSX.Element | null {
  const [isCopied, setIsCopied] = useState<boolean>(false)
  const roomCode: string | null = props.roomCode
  if (roomCode === null) {
    return null
  }

  return (
    <div className={`menu-room-code ${ROOM_CODE_ROW_CLASS_NAME}`}>
      <span className={ROOM_CODE_CAPTION_CLASS_NAME}>{ROOM_CODE_LABEL}</span>
      <span className={`menu-room-code-value ${ROOM_CODE_VALUE_CLASS_NAME}`}>{roomCode}</span>
      <button
        type="button"
        className={`menu-copy-room-code ${SECONDARY_BUTTON_CLASS_NAME}`}
        onClick={(): void => {
          void navigator.clipboard
            .writeText(roomCode)
            .then((): void => {
              setIsCopied(true)
              window.setTimeout((): void => {
                setIsCopied(false)
              }, COPIED_FEEDBACK_MILLISECONDS)
            })
            .catch((): void => {
              // No clipboard (insecure origin): the code stays selectable by hand.
            })
        }}
      >
        {isCopied ? COPIED_LABEL : COPY_LABEL}
      </button>
    </div>
  )
}
