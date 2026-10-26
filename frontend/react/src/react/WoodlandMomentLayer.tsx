import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react'
import { getHudSnapshot, subscribeHud } from '#game/hudStore.ts'
import type {
  ExploreMoment,
  RevoltMoment,
  WoodlandMoment,
  WoodlandMomentBatch,
} from '#game/woodlandMoments.ts'
import {
  MomentBanner,
  MomentRibbon,
  momentFactionName,
} from '#react/MomentPaper.tsx'
import { useKeyframes } from '#react/useKeyframes.ts'

/** How long each moment holds the screen before the next one plays. */
const EXPLORE_RIBBON_HOLD_MS = 2600
const EXPLORE_MOMENT_MS = 3000
const REVOLT_BANNER_OUT_AT_MS = 4700
const REVOLT_MOMENT_MS = 5000
const VEIL_FADE_IN_MS = 350
const VEIL_CLASS_NAME =
  'woodland-moment-veil fixed inset-0 z-260 cursor-root-pointer bg-[radial-gradient(80%_70%_at_50%_50%,rgb(12_10_8/0.45)_0%,rgb(12_10_8/0.8)_100%)]'

type QueuedMoment = {
  key: string
  moment: WoodlandMoment
}

function momentDurationMs(moment: WoodlandMoment): number {
  if (moment.kind === 'explore') return EXPLORE_MOMENT_MS
  if (moment.kind === 'revolt') return REVOLT_MOMENT_MS
  return EXPLORE_MOMENT_MS
}

/** Moments that dim the map; a click on the dim skips to the end. */
function dimsTheMap(moment: WoodlandMoment): boolean {
  return moment.kind === 'turmoil' || moment.kind === 'leaderPick'
}

function ExploreMomentBanner(props: { moment: ExploreMoment }): JSX.Element {
  return (
    <MomentRibbon
      text={`${momentFactionName(props.moment.faction)} explores the ruin`}
      atMs={0}
      holdMs={EXPLORE_RIBBON_HOLD_MS}
    />
  )
}

function RevoltMomentBanner(props: { moment: RevoltMoment }): JSX.Element {
  return (
    <MomentBanner
      faction={props.moment.faction}
      title="Revolt!"
      reason={
        props.moment.suit === null
          ? 'The clearing rises up'
          : `The ${props.moment.suit} clearing rises up`
      }
      inAtMs={0}
      outAtMs={REVOLT_BANNER_OUT_AT_MS}
      className="root-paper-chip-bottom-left"
    />
  )
}

function MomentView(props: { moment: WoodlandMoment }): JSX.Element | null {
  const moment: WoodlandMoment = props.moment
  if (moment.kind === 'explore') {
    return <ExploreMomentBanner moment={moment} />
  }
  if (moment.kind === 'revolt') {
    return <RevoltMomentBanner moment={moment} />
  }
  return null
}

function MomentVeil(props: { onSkip: () => void }): JSX.Element {
  const veilRef = useKeyframes([{ opacity: 0 }, { opacity: 1 }], {
    duration: VEIL_FADE_IN_MS,
    fill: 'both',
  })
  return (
    <div
      ref={veilRef}
      className={VEIL_CLASS_NAME}
      role="button"
      aria-label="Skip"
      tabIndex={-1}
      onClick={props.onSkip}
    />
  )
}

/**
 * Big turns of the game, told over the whole screen for every player, one
 * after the other: explore, revolt, turmoil and the new Eyrie leader.
 */
export function WoodlandMomentLayer(): JSX.Element | null {
  const batch: WoodlandMomentBatch = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().woodlandMoments,
    () => getHudSnapshot().woodlandMoments,
  )
  const [queue, setQueue] = useState<QueuedMoment[]>([])
  // A batch already in the store when the layer mounts is old news.
  const seenSequenceRef = useRef<number>(batch.sequence)

  useEffect(() => {
    if (batch.sequence === seenSequenceRef.current) {
      return
    }
    seenSequenceRef.current = batch.sequence
    const queued: QueuedMoment[] = batch.moments.map(
      (moment: WoodlandMoment, index: number): QueuedMoment => ({
        key: `${String(batch.sequence)}-${String(index)}`,
        moment,
      }),
    )
    setQueue((current: QueuedMoment[]) => [...current, ...queued])
  }, [batch])

  const playing: QueuedMoment | undefined = queue[0]
  const playingKey: string | undefined = playing?.key
  const playingMs: number =
    playing === undefined ? 0 : momentDurationMs(playing.moment)
  const skip = (): void => {
    setQueue((current: QueuedMoment[]) =>
      current.filter((entry: QueuedMoment): boolean => entry.key !== playingKey),
    )
  }

  useEffect(() => {
    if (playingKey === undefined) {
      return undefined
    }
    const timer: number = window.setTimeout(() => {
      setQueue((current: QueuedMoment[]) =>
        current.filter((entry: QueuedMoment): boolean => entry.key !== playingKey),
      )
    }, playingMs)
    return () => {
      window.clearTimeout(timer)
    }
  }, [playingKey, playingMs])

  if (playing === undefined) {
    return null
  }
  return (
    <>
      {dimsTheMap(playing.moment) ? <MomentVeil key="veil" onSkip={skip} /> : null}
      <MomentView key={playing.key} moment={playing.moment} />
    </>
  )
}
