import { useState, type FormEvent, type JSX } from 'react'
import {
  CANCEL_BUTTON_CLASS_NAME,
  LOBBY_FOOTER_CLASS_NAME,
  LOBBY_TITLE_CLASS_NAME,
  PAPER_SHEET_CLASS_NAME,
  PRIMARY_BUTTON_CLASS_NAME,
} from '#react/MenuParts.tsx'

/** Codes the server hands out: six letters and digits. */
export const ROOM_CODE_LENGTH = 6

const JOIN_ROOM_TITLE = 'Enter room code'
const JOIN_ROOM_HINT = 'Ask the host for the code shown in their lobby.'
const JOIN_ROOM_LABEL = 'Join'
const BACK_LABEL = 'Back'
const ROOM_CODE_PLACEHOLDER = 'Room code'
const JOIN_ROOM_FORM_CLASS_NAME = 'menu-join-room m-0 flex w-full flex-shrink-0 flex-col items-center gap-4'
const JOIN_ROOM_SHEET_CLASS_NAME = `${PAPER_SHEET_CLASS_NAME} flex flex-col items-center gap-3`
const JOIN_ROOM_HINT_CLASS_NAME = 'm-0 text-center font-body text-base text-ink-soft italic'
/** Paper slip the code is written on: wide letters, read aloud by players. */
const ROOM_CODE_INPUT_CLASS_NAME =
  'root-paper root-paper-fine m-0 w-full px-4 py-3 text-center font-display text-3xl tracking-[0.3em] text-ink uppercase placeholder:tracking-normal placeholder:normal-case placeholder:text-ink-soft [--root-paper-color:var(--color-parchment-deep)]'

/** Codes are typed loosely: spaces dropped, letters upper case. */
export function normalizeRoomCode(typed: string): string {
  return typed.replace(/\s/g, '').toUpperCase().slice(0, ROOM_CODE_LENGTH)
}

export function isCompleteRoomCode(roomCode: string): boolean {
  return roomCode.length === ROOM_CODE_LENGTH
}

/** Join screen: the guest types the code the host shared, then lands in that lobby. */
export function MenuJoinRoomForm(props: {
  disabled: boolean
  onJoinRoom: (roomCode: string) => void
  onBack: () => void
}): JSX.Element {
  const [roomCode, setRoomCode] = useState<string>('')
  const canJoin: boolean = !props.disabled && isCompleteRoomCode(roomCode)

  return (
    <form
      className={JOIN_ROOM_FORM_CLASS_NAME}
      aria-label={JOIN_ROOM_TITLE}
      onSubmit={(event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault()
        if (canJoin) {
          props.onJoinRoom(roomCode)
        }
      }}
    >
      <h2 className={LOBBY_TITLE_CLASS_NAME}>{JOIN_ROOM_TITLE}</h2>
      <div className={JOIN_ROOM_SHEET_CLASS_NAME}>
        <input
          className={`menu-room-code-input ${ROOM_CODE_INPUT_CLASS_NAME}`}
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoFocus
          spellCheck={false}
          maxLength={ROOM_CODE_LENGTH}
          placeholder={ROOM_CODE_PLACEHOLDER}
          aria-label={ROOM_CODE_PLACEHOLDER}
          value={roomCode}
          disabled={props.disabled}
          onChange={(event): void => {
            setRoomCode(normalizeRoomCode(event.target.value))
          }}
        />
        <p className={JOIN_ROOM_HINT_CLASS_NAME}>{JOIN_ROOM_HINT}</p>
      </div>
      <div className={LOBBY_FOOTER_CLASS_NAME}>
        <button
          type="button"
          className={`menu-join-room-back ${CANCEL_BUTTON_CLASS_NAME}`}
          disabled={props.disabled}
          onClick={props.onBack}
        >
          {BACK_LABEL}
        </button>
        <button
          type="submit"
          className={`menu-join-room-button ${PRIMARY_BUTTON_CLASS_NAME}`}
          disabled={!canJoin}
        >
          {JOIN_ROOM_LABEL}
        </button>
      </div>
    </form>
  )
}
