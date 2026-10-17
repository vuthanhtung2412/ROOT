import { useEffect, useMemo, useState, useSyncExternalStore, type JSX } from 'react'
import { LuBot, LuChevronRight } from 'react-icons/lu'
import { artFactionOf } from '@root/lib/bot-factions'
import { cardImagePublicPath } from '#assets/gameAssets.ts'
import { factionPortraitPath } from '#assets/factionPortraits.ts'
import {
  BOT_STEP_DELAY_SECONDS_CHOICES,
  botStepDelaySeconds,
  nextBotStepDelaySeconds,
  setBotStepDelaySeconds,
  subscribeBotPace,
} from '#game/botPace.ts'
import { getHudCallbacks, getHudSnapshot, subscribeHud } from '#game/hudStore.ts'
import { isSoloGameOpen } from '#game/soloGame.ts'
import { factionColorCss } from '#game/theme.ts'
import { FACTION_FRAME_CLASS_NAMES } from '#react/ActionTray.tsx'
import { cardNameOf, factionLogName, LogPart } from '#react/GameLog.tsx'
import { SuitIcon } from '#react/SuitIcon.tsx'
import { useKeyframes } from '#react/useKeyframes.ts'
import {
  botTakingTurn,
  buildBotTurnBannerViewModel,
  nextLatestStepStart,
  type BotOrderCardView,
  type BotTurnLog,
  type BotTurnAction,
  type BotTurnBannerViewModel,
} from '#ui/botTurnBannerViewModel.ts'
import type { GameLogContext, GameLogPart } from '#ui/gameLog.ts'

/** Where the action dock sits on the player's turn; the toasts stack up from it. */
const STACK_CLASS_NAME =
  'bot-turn-banner pointer-events-none fixed right-2 bottom-2 z-120 box-border flex w-[calc(100vw-16px)] flex-col items-stretch gap-1.5 md:right-3 md:bottom-3 md:w-[380px]'
const TOAST_CLASS_NAME =
  'root-paper root-paper-fine pointer-events-auto m-0 flex w-full flex-row items-baseline gap-2 border-l-6 px-2.5 py-1.5 text-left font-body text-sm leading-snug text-ink [--root-paper-color:var(--color-paper-bright)] md:text-base'
const LATEST_TOAST_CLASS_NAME = `bot-turn-banner__latest ${TOAST_CLASS_NAME}`
const EARLIER_TOAST_CLASS_NAME = `bot-turn-banner__earlier ${TOAST_CLASS_NAME}`
/** Older toasts fade out: the last of these sits right above the latest step. */
const EARLIER_TOAST_FADE_CLASS_NAMES: readonly string[] = ['opacity-40', 'opacity-60', 'opacity-80']
const TOAST_CLICKABLE_CLASS_NAME = 'cursor-root-pointer'
const ACTION_NUMBER_CLASS_NAME =
  'root-paper root-paper-fine shrink-0 px-1.5 font-display text-sm text-parchment [--root-paper-color:var(--color-rust)]'
const HEAD_CLASS_NAME =
  'bot-turn-banner__head root-paper pointer-events-auto mt-9 flex flex-row items-center gap-3 px-3 py-2 text-parchment'
const ORDER_CARD_CLASS_NAME =
  'bot-turn-banner__order -mt-9 flex w-14 shrink-0 flex-col items-center md:w-16'
const ORDER_CARD_IMAGE_CLASS_NAME =
  'block w-full -rotate-4 rounded-md border-2 border-parchment shadow-card select-none'
const ORDER_LABEL_CLASS_NAME =
  'flex flex-row items-center gap-1 font-display text-xs leading-none uppercase tracking-wide'
const HEAD_TEXT_CLASS_NAME = 'flex min-w-0 flex-1 flex-col gap-0.5'
const HEAD_NAME_CLASS_NAME =
  'flex flex-row items-center gap-1.5 font-display text-base leading-tight capitalize md:text-lg'
const HEAD_STEP_CLASS_NAME = 'font-body text-xs capitalize opacity-85 md:text-sm'
const PACE_BUTTON_CLASS_NAME =
  'bot-turn-banner__pace root-paper root-paper-fine root-paper-press m-0 flex h-9 w-14 shrink-0 flex-row items-center justify-center p-0 text-lg text-ink [--root-paper-color:var(--color-paper-bright)]'
const PACE_CHEVRON_CLASS_NAME = '-mx-1 shrink-0'
const PORTRAIT_CLASS_NAME = 'size-6 rounded-sm object-cover md:size-7'

const WAITING_TEXT = 'thinking…'
/** Key of the order card slot while the bot has no order card. */
const NO_ORDER_CARD_KEY = 'no-order'
const NEUTRAL_HEAD_CLASS_NAME = '[--root-paper-color:var(--color-wood)]'

/** Slides each new action in from the right, with a short glow. */
const LATEST_ACTION_KEYFRAMES: Keyframe[] = [
  { opacity: 0, transform: 'translateX(24px)', backgroundColor: 'var(--color-gold-light)' },
  { opacity: 1, transform: 'translateX(0)', backgroundColor: 'var(--color-gold-light)', offset: 0.35 },
  { opacity: 1, transform: 'translateX(0)', backgroundColor: 'transparent' },
]
const LATEST_ACTION_ANIMATION: KeyframeAnimationOptions = { duration: 900, easing: 'ease-out' }
/** A new order card flips in. */
const ORDER_CARD_KEYFRAMES: Keyframe[] = [
  { opacity: 0, transform: 'rotateY(90deg) scale(0.8)' },
  { opacity: 1, transform: 'rotateY(0) scale(1.08)', offset: 0.6 },
  { opacity: 1, transform: 'rotateY(0) scale(1)' },
]
const ORDER_CARD_ANIMATION: KeyframeAnimationOptions = { duration: 700, easing: 'ease-out' }
/** The stack rises in when the bot's turn starts. */
const STACK_KEYFRAMES: Keyframe[] = [
  { opacity: 0, transform: 'translateY(16px)' },
  { opacity: 1, transform: 'translateY(0)' },
]
const STACK_ANIMATION: KeyframeAnimationOptions = { duration: 400, easing: 'ease-out' }

function firstClearingOf(parts: readonly GameLogPart[]): number | null {
  for (const part of parts) {
    if (part.kind === 'clearing') return part.clearingId
  }
  return null
}

function ActionParts(props: { action: BotTurnAction }): JSX.Element {
  return (
    <span className="min-w-0">
      {props.action.parts.map(
        (part: GameLogPart, partIndex: number): JSX.Element => (
          <LogPart key={partIndex} part={part} />
        ),
      )}
    </span>
  )
}

interface ActionToastProps {
  action: BotTurnAction
  faction: string
  className: string
}

/** One bot action; a click points the camera at its clearing. */
function ActionToast(props: ActionToastProps): JSX.Element {
  const clearingId: number | null = firstClearingOf(props.action.parts)
  return (
    <button
      type="button"
      className={clearingId === null ? props.className : `${props.className} ${TOAST_CLICKABLE_CLASS_NAME}`}
      style={{ borderLeftColor: factionColorCss(props.faction) }}
      disabled={clearingId === null}
      onClick={(): void => {
        if (clearingId !== null) getHudCallbacks().onLogClearingClick(clearingId)
      }}
    >
      <span className={ACTION_NUMBER_CLASS_NAME}>{String(props.action.number)}</span>
      <ActionParts action={props.action} />
    </button>
  )
}

function LatestToast(props: { action: BotTurnAction; faction: string }): JSX.Element {
  const slideRef = useKeyframes(LATEST_ACTION_KEYFRAMES, LATEST_ACTION_ANIMATION)
  return (
    <div ref={slideRef} aria-live="polite">
      <ActionToast action={props.action} faction={props.faction} className={LATEST_TOAST_CLASS_NAME} />
    </div>
  )
}

function OrderCard(props: { card: BotOrderCardView | null }): JSX.Element {
  const flipRef = useKeyframes(ORDER_CARD_KEYFRAMES, ORDER_CARD_ANIMATION)
  const { card } = props
  const imagePath: string | null =
    card === null ? null : cardImagePublicPath(card.definitionId)
  return (
    <div ref={flipRef} className={ORDER_CARD_CLASS_NAME}>
      {imagePath !== null && card !== null ? (
        <img
          className={ORDER_CARD_IMAGE_CLASS_NAME}
          src={imagePath}
          alt={card.name}
          title={card.name}
          draggable={false}
        />
      ) : (
        <span className={ORDER_LABEL_CLASS_NAME}>
          {card === null ? null : <SuitIcon suit={card.suit} className="size-3.5" alt="" />}
          {card === null ? 'no order' : card.name}
        </span>
      )}
    </div>
  )
}

const PACE_LABEL = 'Bot pace, click for faster'

/** One button: › / ›› / ››› for 5 / 2 / 1 s after each bot action. */
function PaceButton(): JSX.Element {
  const delaySeconds: number = useSyncExternalStore(
    subscribeBotPace,
    botStepDelaySeconds,
    botStepDelaySeconds,
  )
  const chevronCount: number = BOT_STEP_DELAY_SECONDS_CHOICES.indexOf(delaySeconds) + 1
  const label = `${PACE_LABEL} (${String(delaySeconds)} s per action)`
  return (
    <button
      type="button"
      className={PACE_BUTTON_CLASS_NAME}
      aria-label={label}
      title={label}
      onClick={(): void => {
        setBotStepDelaySeconds(nextBotStepDelaySeconds(delaySeconds))
      }}
    >
      {Array.from({ length: chevronCount }, (_unused: undefined, chevronIndex: number): JSX.Element => (
        <LuChevronRight key={chevronIndex} className={PACE_CHEVRON_CLASS_NAME} aria-hidden="true" />
      ))}
    </button>
  )
}

function BotTurnHead(props: { view: BotTurnBannerViewModel }): JSX.Element {
  const { view } = props
  const portraitPath: string | null = factionPortraitPath(view.faction)
  const colorClassName: string =
    FACTION_FRAME_CLASS_NAMES[artFactionOf(view.faction)] ?? NEUTRAL_HEAD_CLASS_NAME
  return (
    <header className={`${HEAD_CLASS_NAME} ${colorClassName}`}>
      <OrderCard key={view.orderCard?.cardId ?? NO_ORDER_CARD_KEY} card={view.orderCard} />
      <div className={HEAD_TEXT_CLASS_NAME}>
        <span className={HEAD_NAME_CLASS_NAME}>
          {portraitPath !== null ? (
            <img className={PORTRAIT_CLASS_NAME} src={portraitPath} alt="" draggable={false} />
          ) : (
            <LuBot aria-hidden="true" />
          )}
          {factionLogName(view.faction)}
        </span>
        <span className={HEAD_STEP_CLASS_NAME}>{`${view.phase} · ${view.step}`}</span>
      </div>
      {isSoloGameOpen() ? <PaceButton /> : null}
    </header>
  )
}

function BotTurnStack(props: { view: BotTurnBannerViewModel }): JSX.Element {
  const { view } = props
  const riseRef = useKeyframes(STACK_KEYFRAMES, STACK_ANIMATION)
  const firstLatestAction: BotTurnAction | null = view.latestActions[0] ?? null
  const latestKey: string | null = firstLatestAction?.key ?? null
  const latestClearing: number | null =
    firstLatestAction === null ? null : firstClearingOf(firstLatestAction.parts)
  const fadeOffset: number = EARLIER_TOAST_FADE_CLASS_NAMES.length - view.earlierActions.length

  // Each new step points at its clearing on the map.
  useEffect((): void => {
    if (latestKey !== null && latestClearing !== null) {
      getHudCallbacks().onLogClearingClick(latestClearing)
    }
  }, [latestKey, latestClearing])

  return (
    <section ref={riseRef} className={STACK_CLASS_NAME} aria-label="Bot turn">
      {view.earlierActions.map(
        (action: BotTurnAction, actionIndex: number): JSX.Element => (
          <ActionToast
            key={action.key}
            action={action}
            faction={view.faction}
            className={`${EARLIER_TOAST_CLASS_NAME} ${EARLIER_TOAST_FADE_CLASS_NAMES[fadeOffset + actionIndex] ?? ''}`}
          />
        ),
      )}
      {view.latestActions.length > 0 ? (
        view.latestActions.map(
          (action: BotTurnAction): JSX.Element => (
            <LatestToast key={action.key} action={action} faction={view.faction} />
          ),
        )
      ) : (
        <p className={`${TOAST_CLASS_NAME} italic`} style={{ borderLeftColor: factionColorCss(view.faction) }}>
          {WAITING_TEXT}
        </p>
      )}
      <BotTurnHead view={view} />
    </section>
  )
}

/** True while a bot takes its turn: the toast stack replaces the top banners. */
export function useIsBotTakingTurn(): boolean {
  return useSyncExternalStore(subscribeHud, isBotTakingTurnNow, isBotTakingTurnNow)
}

function isBotTakingTurnNow(): boolean {
  const rail = getHudSnapshot().playerRail
  return rail !== null && botTakingTurn(rail.state) !== null
}

/** While a bot takes its turn: its order card and its actions, one by one. */
export function BotTurnBanner(): JSX.Element | null {
  const log: readonly unknown[] = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().gameLog,
    () => getHudSnapshot().gameLog,
  )
  const rail = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().playerRail,
    () => getHudSnapshot().playerRail,
  )
  // The previous log, kept to tell which actions the latest push brought.
  const [turnLog, setTurnLog] = useState<BotTurnLog>({ log, latestStepStart: 0 })
  if (turnLog.log !== log) {
    setTurnLog({
      log,
      latestStepStart: nextLatestStepStart(turnLog.log, log, turnLog.latestStepStart),
    })
  }
  const view: BotTurnBannerViewModel | null = useMemo((): BotTurnBannerViewModel | null => {
    if (rail === null) return null
    const state = rail.state
    const context: GameLogContext = {
      factionOfSeat: (seat: number): string => state.factions[seat] ?? `seat ${String(seat + 1)}`,
      cardName: cardNameOf,
    }
    return buildBotTurnBannerViewModel(state, turnLog, context)
  }, [rail, turnLog])

  if (view === null) return null
  // A new bot turn mounts a new stack: it rises in again.
  return <BotTurnStack key={view.faction} view={view} />
}
