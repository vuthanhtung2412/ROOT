import { useSyncExternalStore, type JSX } from 'react'
import type { IconType } from 'react-icons'
import { LuBot, LuLoaderCircle, LuTriangleAlert } from 'react-icons/lu'
import type { AiPlayer } from '#api/client.ts'
import {
  findAiPlayer,
  getAiPlayerSnapshot,
  modelDisplayName,
  subscribeAiPlayers,
  type AiPlayerStoreState,
} from '#game/aiPlayerStore.ts'
import { Tooltip } from '#react/Tooltip.tsx'

type AiSeatStatusView = {
  /** Read in the tooltip after the model name. */
  label: string
  Icon: IconType
  iconClassName: string
  /** Paper colour of the medallion. */
  paperClassName: string
}

const AI_SEAT_STATUS_VIEWS: Readonly<
  Record<AiPlayer['status'], AiSeatStatusView>
> = {
  idle: {
    label: 'waiting',
    Icon: LuBot,
    iconClassName: '',
    paperClassName: '[--root-paper-color:var(--color-parchment-deep)]',
  },
  thinking: {
    label: 'thinking',
    Icon: LuLoaderCircle,
    iconClassName: 'animate-spin',
    paperClassName: '[--root-paper-color:var(--color-gold)]',
  },
  stuck: {
    label: 'stuck',
    Icon: LuTriangleAlert,
    iconClassName: '',
    paperClassName: '[--root-paper-color:var(--color-rust)]',
  },
}

/** Bottom middle of the seat tile, between the score and the seat buttons. */
const AI_SEAT_BADGE_POSITION_CLASS_NAME =
  'absolute -bottom-3.5 left-1/2 -translate-x-1/2'
const AI_SEAT_BADGE_CLASS_NAME =
  'player-rail__ai-player root-paper root-medallion flex size-6 items-center justify-center text-sm text-ink md:size-7 md:text-base'

/** Marks a seat played by an AI: which model, and what it is doing. */
export function AiSeatBadge(props: { seat: number }): JSX.Element | null {
  const aiPlayerStore: AiPlayerStoreState = useSyncExternalStore(
    subscribeAiPlayers,
    getAiPlayerSnapshot,
    getAiPlayerSnapshot,
  )
  const aiPlayer: AiPlayer | null = findAiPlayer(
    aiPlayerStore.aiPlayers,
    props.seat,
  )
  if (aiPlayer === null) {
    return null
  }
  const statusView: AiSeatStatusView = AI_SEAT_STATUS_VIEWS[aiPlayer.status]
  const label = `AI · ${modelDisplayName(aiPlayer.model)} · ${statusView.label}`
  return (
    <Tooltip label={label} className={AI_SEAT_BADGE_POSITION_CLASS_NAME}>
      <span
        className={`${AI_SEAT_BADGE_CLASS_NAME} ${statusView.paperClassName}`}
        data-ai-status={aiPlayer.status}
        role="img"
        aria-label={label}
      >
        <statusView.Icon
          className={statusView.iconClassName}
          aria-hidden="true"
        />
      </span>
    </Tooltip>
  )
}
