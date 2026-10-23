import { useState, type FormEvent, type JSX } from 'react'
import { SECONDARY_BUTTON_CLASS_NAME } from '#react/MenuParts.tsx'

/** Codes the server hands out: six letters and digits. */
export const ROOM_CODE_LENGTH = 6

const JOIN_ROOM_LABEL = 'Join'
const ROOM_CODE_PLACEHOLDER = 'Room code'
const JOIN_ROOM_FORM_CLASS_NAME = 'flex min-w-65 flex-row items-stretch gap-2'
/** Paper slip the code is written on: wide letters, read aloud by players. */
const ROOM_CODE_INPUT_CLASS_NAME =
  'root-paper root-paper-fine m-0 w-0 flex-1 px-4 py-2 font-display text-xl tracking-[0.3em] text-ink uppercase placeholder:tracking-normal placeholder:normal-case placeholder:text-ink-soft [--root-paper-color:var(--color-parchment-deep)]'

/** Codes are typed loosely: spaces dropped, letters upper case. */
export function normalizeRoomCode(typed: string): string {
  return typed.replace(/\s/g, '').toUpperCase().slice(0, ROOM_CODE_LENGTH)
}

export function isCompleteRoomCode(roomCode: string): boolean {
  return roomCode.length === ROOM_CODE_LENGTH
}

/** Join with code: the guest types the code the host shared. */
export function MenuJoinRoomForm(props: {
  disabled: boolean
  onJoinRoom: (roomCode: string) => void
}): JSX.Element {
  const [roomCode, setRoomCode] = useState<string>('')
  const canJoin: boolean = !props.disabled && isCompleteRoomCode(roomCode)

  return (
    <form
      className={`menu-join-room ${JOIN_ROOM_FORM_CLASS_NAME}`}
      onSubmit={(event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault()
        if (canJoin) {
          props.onJoinRoom(roomCode)
        }
      }}
    >
      <input
        className={`menu-room-code-input ${ROOM_CODE_INPUT_CLASS_NAME}`}
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
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
      <button
        type="submit"
        className={`menu-join-room-button ${SECONDARY_BUTTON_CLASS_NAME}`}
        disabled={!canJoin}
      >
        {JOIN_ROOM_LABEL}
      </button>
    </form>
  )
}
