import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react'
import { LuScrollText, LuX } from 'react-icons/lu'
import { lookupCardCatalog } from '#assets/gameAssets.ts'
import {
  getHudCallbacks,
  getHudSnapshot,
  patchHud,
  subscribeHud,
} from '#game/hudStore.ts'
import { factionColorCss } from '#game/theme.ts'
import {
  buildGameLogLines,
  type GameLogContext,
  type GameLogLine,
  type GameLogPart,
} from '#ui/gameLog.ts'

const CARD_ID_SEPARATOR = '#'
const VIZIER_CARD_ID_PREFIX = 'vizier-'
const VIZIER_CARD_NAME = 'Loyal Vizier'
const EMPTY_LOG_MESSAGE = 'No action yet.'

/** Beside the map, not over it: a clicked clearing must stay in view. */
const PANEL_CLASS_NAME =
  'game-log root-paper pointer-events-auto fixed top-16 right-2 bottom-36 z-115 flex w-[min(86vw,340px)] flex-col gap-2 px-3 py-3 text-ink [--root-paper-color:color-mix(in_srgb,var(--color-cream)_70%,transparent)] md:right-3 md:bottom-52'
const CLOSE_BUTTON_CLASS_NAME =
  'root-paper root-paper-fine root-paper-press m-0 flex size-8 items-center justify-center p-0 text-xl text-parchment [--root-paper-color:var(--color-rust)]'
const TURN_HEADING_CLASS_NAME =
  'game-log__turn mt-2 border-b-2 pb-0.5 font-display text-base capitalize first:mt-0'
const ACTION_LINE_CLASS_NAME =
  'game-log__action border-l-4 py-0.5 pl-2 font-body text-sm leading-snug'
const CARD_NAME_CLASS_NAME = 'game-log__card font-semibold italic'
/** A clearing of the log: click it and the map shows where it is. */
const CLEARING_REFERENCE_CLASS_NAME =
  'clearing-highlight root-button root-button--quiet mx-0.5 inline-block cursor-root-pointer px-1.5 py-0 font-mono text-sm leading-tight'

function cardNameOf(cardId: string): string | null {
  if (cardId.startsWith(VIZIER_CARD_ID_PREFIX)) return VIZIER_CARD_NAME
  const definitionId: string = cardId.split(CARD_ID_SEPARATOR)[0] ?? cardId
  return lookupCardCatalog(definitionId)?.name ?? null
}

/** "C7": highlights clearing 7 on the map when clicked. */
export function ClearingHighlight(props: { clearingId: number }): JSX.Element {
  return (
    <button
      type="button"
      className={CLEARING_REFERENCE_CLASS_NAME}
      title="Show this clearing on the map"
      onClick={(): void => {
        getHudCallbacks().onLogClearingClick(props.clearingId)
      }}
    >
      {`C${String(props.clearingId)}`}
    </button>
  )
}

function LogPart(props: { part: GameLogPart }): JSX.Element {
  const { part } = props
  if (part.kind === 'clearing') {
    return <ClearingHighlight clearingId={part.clearingId} />
  }
  if (part.kind === 'card') {
    return <span className={CARD_NAME_CLASS_NAME}>{`${part.name} `}</span>
  }
  return <span>{`${part.text} `}</span>
}

function LogLine(props: { line: GameLogLine }): JSX.Element {
  const { line } = props
  const factionColor: string = factionColorCss(line.faction)
  if (line.kind === 'turn') {
    return (
      <li className={TURN_HEADING_CLASS_NAME} style={{ borderColor: factionColor }}>
        {`${line.faction} turn`}
      </li>
    )
  }
  return (
    <li className={ACTION_LINE_CLASS_NAME} style={{ borderColor: factionColor }}>
      <span className="capitalize">{`${line.faction}: `}</span>
      {line.parts.map(
        (part: GameLogPart, partIndex: number): JSX.Element => (
          <LogPart key={partIndex} part={part} />
        ),
      )}
    </li>
  )
}

function GameLogPanel(props: {
  lines: readonly GameLogLine[]
  onClose: () => void
}): JSX.Element {
  const listEnd = useRef<HTMLLIElement | null>(null)
  // Keep the latest action in view as the log grows.
  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: 'end' })
  }, [props.lines.length])

  return (
    <aside className={PANEL_CLASS_NAME} aria-label="Game log">
      <header className="flex flex-row items-center justify-between">
        <h2 className="m-0 font-display text-xl font-normal">Game log</h2>
        <button
          type="button"
          className={CLOSE_BUTTON_CLASS_NAME}
          aria-label="Close game log"
          onClick={props.onClose}
        >
          <LuX aria-hidden="true" />
        </button>
      </header>
      <ol className="m-0 flex min-h-0 flex-1 list-none flex-col gap-1 overflow-y-auto p-0 pr-1">
        {props.lines.length === 0 ? (
          <li className="font-body text-sm italic">{EMPTY_LOG_MESSAGE}</li>
        ) : (
          props.lines.map(
            (line: GameLogLine): JSX.Element => (
              <LogLine key={line.key} line={line} />
            ),
          )
        )}
        <li ref={listEnd} aria-hidden="true" />
      </ol>
    </aside>
  )
}

/** Drawer chip that opens the game log beside the map. */
export function GameLogButton(props: { className: string }): JSX.Element {
  const log = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().gameLog,
    () => getHudSnapshot().gameLog,
  )
  const factions = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().playerRail?.state.factions,
    () => getHudSnapshot().playerRail?.state.factions,
  )
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const lines: GameLogLine[] = useMemo((): GameLogLine[] => {
    const context: GameLogContext = {
      factionOfSeat: (seat: number): string =>
        factions?.[seat] ?? `seat ${String(seat + 1)}`,
      cardName: cardNameOf,
    }
    return buildGameLogLines(log, context)
  }, [factions, log])

  return (
    <>
      <button
        type="button"
        className={`game-log-button ${props.className}`}
        aria-expanded={isOpen}
        onClick={(): void => {
          setIsOpen(!isOpen)
        }}
      >
        <LuScrollText aria-hidden="true" />
        Log
      </button>
      {isOpen ? (
        <GameLogPanel
          lines={lines}
          onClose={(): void => {
            setIsOpen(false)
          }}
        />
      ) : null}
    </>
  )
}

/** Entries of the server log, as the viewer may see them. */
export function syncGameLog(log: readonly unknown[]): void {
  if (getHudSnapshot().gameLog === log) {
    return
  }
  patchHud({ gameLog: log })
}
