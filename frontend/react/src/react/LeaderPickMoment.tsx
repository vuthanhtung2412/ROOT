import {
  useEffect,
  useRef,
  useState,
  type JSX,
  type RefObject,
} from 'react'
import type { EyrieLeaderId } from '#assets/eyrieLeaderCatalog.ts'
import { EYRIE_MOMENT_SLOWDOWN, momentMs } from '#game/momentPace.ts'
import type { LeaderPickMoment } from '#game/woodlandMoments.ts'
import {
  MomentRibbon,
  momentFactionName,
  SETTLE_EASING,
} from '#react/MomentPaper.tsx'
import { SuitIcon } from '#react/SuitIcon.tsx'
import { LeaderCard } from '#react/TurmoilMoment.tsx'
import { useMomentKeyframeSteps } from '#react/useKeyframes.ts'
import {
  EYRIE_DECREE_COLUMNS,
  type EyrieDecreeColumnId,
} from '#ui/factionBoardViewModel.ts'

/** Beats of a leader pick, from its start (ms, mockup pace). */
const RIBBON_HOLD_MS = 3600
const DEAL_AT_MS = 120
const DEAL_STAGGER_MS = 110
const DEAL_MS = 480
/** Cards fan out a little, by their place from the middle of the row. */
const DEAL_START_TILT_DEGREES = 8
const DEAL_END_TILT_DEGREES = 2
const FACE_DOWN_DIM_AT_MS = 700
const FACE_DOWN_DIM_MS = 300
const CHOOSE_AT_MS = 1700
const LIFT_MS = 500
/** The chosen card grows this much as it lifts. */
const LIFT_SCALE = 1.18
const OTHERS_SINK_MS = 450
const FLIGHT_AT_MS = 2400
const FLIGHT_MS = 560
const FLIGHT_EASING = 'cubic-bezier(0.45, 0, 0.25, 1)'
const VIZIER_AT_MS = 3000
const VIZIER_STAGGER_MS = 200
const VIZIER_POP_MS = 450
const BOARD_IN_MS = 300
export const LEADER_PICK_MOMENT_MS = 4300

const LEADER_ORDER: readonly EyrieLeaderId[] = [
  'builder',
  'charismatic',
  'commander',
  'despot',
]
const ROW_MIDDLE = (LEADER_ORDER.length - 1) / 2
const HALF = 0.5
const COLUMN_TITLES: Readonly<Record<EyrieDecreeColumnId, string>> = {
  recruit: 'Recruit',
  move: 'Move',
  battle: 'Battle',
  build: 'Build',
}

const ROW_CLASS_NAME =
  'pointer-events-none fixed top-[52vh] left-1/2 z-262 flex -translate-1/2 flex-row gap-3 md:gap-6'
const PICK_CLASS_NAME = 'relative flex flex-col items-center gap-2 opacity-0'
const CAPTION_CLASS_NAME =
  'font-display text-sm tracking-wide text-parchment-deep md:text-base'
const BOARD_CLASS_NAME =
  'root-paper pointer-events-none fixed bottom-4 left-4 z-261 flex flex-row items-start gap-1.5 p-2 opacity-0 [--root-paper-color:var(--color-eyrie-deep)] md:bottom-6 md:left-6'
const LEADER_SLOT_CLASS_NAME =
  'aspect-5/7 w-14 rounded-md border-2 border-dashed border-parchment/40 md:w-16'
const BOARD_COLUMN_CLASS_NAME =
  'flex min-h-20 w-12 flex-col items-center gap-1 rounded-sm bg-black/25 p-1 md:w-14'
const BOARD_COLUMN_TITLE_CLASS_NAME = 'font-display text-[11px] text-parchment'
const VIZIER_CLASS_NAME =
  'flex size-8 items-center justify-center rounded-full border-2 border-ink bg-parchment ring-2 ring-gold'
const FLYING_CARD_CLASS_NAME = 'pointer-events-none fixed z-263'
const FLYING_CARD_FACE_CLASS_NAME = 'relative size-full transform-3d'
const CHOSEN_GLOW = 'drop-shadow(0 0 16px var(--color-gold-light))'

/** Where the chosen card flies from and to, in the viewport (px). */
type CardBox = {
  left: number
  top: number
  width: number
  height: number
  rotateDegrees: number
}

type CardFlight = {
  from: CardBox
  to: CardBox
}

function tiltOf(index: number): number {
  return (index - ROW_MIDDLE) * DEAL_END_TILT_DEGREES
}

function dealTransform(index: number, tiltDegrees: number, lift: string): string {
  return `translateY(${lift}) rotate(${String((index - ROW_MIDDLE) * tiltDegrees)}deg)`
}

/**
 * The card as it shows in the row: its centre (rotation does not move it),
 * its size grown by the lift, turned by the deal tilt.
 */
function shownCardBox(card: HTMLDivElement, index: number): CardBox {
  const bounds: DOMRect = card.getBoundingClientRect()
  const width: number = card.offsetWidth * LIFT_SCALE
  const height: number = card.offsetHeight * LIFT_SCALE
  return {
    left: bounds.left + bounds.width * HALF - width * HALF,
    top: bounds.top + bounds.height * HALF - height * HALF,
    width,
    height,
    rotateDegrees: tiltOf(index),
  }
}

function slotBox(slot: HTMLDivElement): CardBox {
  const bounds: DOMRect = slot.getBoundingClientRect()
  return {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
    rotateDegrees: 0,
  }
}

/** Where a box sits, as an animation keyframe and as the starting style. */
type BoxStyle = {
  left: string
  top: string
  width: string
  height: string
  transform: string
}

function boxKeyframe(box: CardBox): BoxStyle {
  return {
    left: `${String(box.left)}px`,
    top: `${String(box.top)}px`,
    width: `${String(box.width)}px`,
    height: `${String(box.height)}px`,
    transform: `rotate(${String(box.rotateDegrees)}deg)`,
  }
}

/** The chosen card on its way from the row into the leader slot. */
function FlyingLeaderCard(props: {
  leader: EyrieLeaderId
  flight: CardFlight
}): JSX.Element {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const flight: CardFlight = props.flight
  useEffect(() => {
    const card: HTMLDivElement | null = cardRef.current
    if (card === null || typeof card.animate !== 'function') {
      return undefined
    }
    const animation: Animation = card.animate(
      [boxKeyframe(flight.from), boxKeyframe(flight.to)],
      {
        duration: momentMs(FLIGHT_MS, EYRIE_MOMENT_SLOWDOWN),
        easing: FLIGHT_EASING,
        fill: 'forwards',
      },
    )
    return () => {
      animation.cancel()
    }
  }, [flight])
  return (
    <div
      ref={cardRef}
      className={FLYING_CARD_CLASS_NAME}
      style={boxKeyframe(flight.from)}
    >
      <LeaderCard
        leader={props.leader}
        flipAtMs={null}
        className={FLYING_CARD_FACE_CLASS_NAME}
      />
    </div>
  )
}

type LeaderPickProps = {
  leader: EyrieLeaderId
  index: number
  isChosen: boolean
  isFaceDown: boolean
  /** The chosen card has left the row: it flies on its own. */
  hasFlown: boolean
  cardRef: RefObject<HTMLDivElement | null> | null
}

function LeaderPick(props: LeaderPickProps): JSX.Element {
  const dealRef = useMomentKeyframeSteps([
    {
      keyframes: [
        { opacity: 0, transform: dealTransform(props.index, DEAL_START_TILT_DEGREES, '60%') },
        { opacity: 1, transform: dealTransform(props.index, DEAL_END_TILT_DEGREES, '0') },
      ],
      options: {
        duration: DEAL_MS,
        delay: DEAL_AT_MS + props.index * DEAL_STAGGER_MS,
        easing: SETTLE_EASING,
        fill: 'both',
      },
    },
    ...(props.isChosen
      ? []
      : [
          {
            keyframes: [{ opacity: 1 }, { opacity: 0, transform: 'translateY(40%)' }],
            options: {
              duration: OTHERS_SINK_MS,
              delay: CHOOSE_AT_MS,
              easing: 'ease-in',
              fill: 'forwards' as const,
            },
          },
        ]),
  ])
  const liftRef = useMomentKeyframeSteps([
    ...(props.isFaceDown
      ? [
          {
            keyframes: [{ filter: 'none' }, { filter: 'grayscale(0.6) brightness(0.7)' }],
            options: { duration: FACE_DOWN_DIM_MS, delay: FACE_DOWN_DIM_AT_MS, fill: 'forwards' as const },
          },
        ]
      : []),
    ...(props.isChosen
      ? [
          {
            keyframes: [
              { transform: 'translateY(0) scale(1)', filter: 'none' },
              { transform: `translateY(-18%) scale(${String(LIFT_SCALE)})`, filter: CHOSEN_GLOW },
            ],
            options: { duration: LIFT_MS, delay: CHOOSE_AT_MS, easing: SETTLE_EASING, fill: 'forwards' as const },
          },
        ]
      : []),
  ])
  return (
    <div ref={dealRef} className={PICK_CLASS_NAME}>
      <div ref={liftRef} className={props.hasFlown ? 'invisible' : undefined}>
        <div ref={props.cardRef}>
          <LeaderCard leader={props.leader} flipAtMs={null} faceDown={props.isFaceDown} />
        </div>
      </div>
      <span className={props.hasFlown ? `${CAPTION_CLASS_NAME} invisible` : CAPTION_CLASS_NAME}>
        {props.isFaceDown ? 'Deposed' : props.leader.charAt(0).toUpperCase() + props.leader.slice(1)}
      </span>
    </div>
  )
}

/** A Loyal Vizier popping into its decree column. */
function BoardVizier(props: { order: number }): JSX.Element {
  const vizierRef = useMomentKeyframeSteps([
    {
      keyframes: [
        { opacity: 0, transform: 'scale(0)' },
        { opacity: 1, transform: 'scale(1.3)', offset: 0.7 },
        { opacity: 1, transform: 'scale(1)' },
      ],
      options: {
        duration: VIZIER_POP_MS,
        delay: VIZIER_AT_MS + props.order * VIZIER_STAGGER_MS,
        easing: 'ease-out',
        fill: 'both',
      },
    },
  ])
  return (
    <div ref={vizierRef} className={VIZIER_CLASS_NAME}>
      <SuitIcon suit="bird" className="size-3/4 object-contain" />
    </div>
  )
}

/**
 * The Eyrie choose a leader: the four cards deal in (deposed ones face
 * down), the chosen one lifts and flies into the leader slot of the board,
 * and its Loyal Viziers join their decree columns.
 */
export function LeaderPickMomentView(props: { moment: LeaderPickMoment }): JSX.Element {
  const moment: LeaderPickMoment = props.moment
  const slotRef = useRef<HTMLDivElement | null>(null)
  const chosenCardRef = useRef<HTMLDivElement | null>(null)
  const [flight, setFlight] = useState<CardFlight | null>(null)
  const chosenIndex: number = LEADER_ORDER.indexOf(moment.chosen)
  const boardRef = useMomentKeyframeSteps([
    {
      keyframes: [{ opacity: 0 }, { opacity: 1 }],
      options: { duration: BOARD_IN_MS, fill: 'both' },
    },
  ])

  // Measured when it leaves, so the card starts exactly where it shows.
  useEffect(() => {
    const timer: number = window.setTimeout(() => {
      const card: HTMLDivElement | null = chosenCardRef.current
      const slot: HTMLDivElement | null = slotRef.current
      if (card !== null && slot !== null) {
        setFlight({ from: shownCardBox(card, chosenIndex), to: slotBox(slot) })
      }
    }, momentMs(FLIGHT_AT_MS, EYRIE_MOMENT_SLOWDOWN))
    return () => {
      window.clearTimeout(timer)
    }
  }, [chosenIndex])

  return (
    <>
      <MomentRibbon
        text={`${momentFactionName(moment.faction)} are choosing a leader.`}
        atMs={0}
        holdMs={RIBBON_HOLD_MS}
      />
      <div className={ROW_CLASS_NAME}>
        {LEADER_ORDER.map((leader: EyrieLeaderId, index: number) => (
          <LeaderPick
            key={leader}
            leader={leader}
            index={index}
            isChosen={leader === moment.chosen}
            isFaceDown={leader !== moment.chosen && moment.faceDown.includes(leader)}
            hasFlown={leader === moment.chosen && flight !== null}
            cardRef={leader === moment.chosen ? chosenCardRef : null}
          />
        ))}
      </div>
      <div ref={boardRef} className={BOARD_CLASS_NAME}>
        <div ref={slotRef} className={LEADER_SLOT_CLASS_NAME} />
        {EYRIE_DECREE_COLUMNS.map((columnId: EyrieDecreeColumnId) => (
          <div key={columnId} className={BOARD_COLUMN_CLASS_NAME}>
            <span className={BOARD_COLUMN_TITLE_CLASS_NAME}>{COLUMN_TITLES[columnId]}</span>
            {moment.vizierColumns.map((vizierColumn: EyrieDecreeColumnId, order: number) =>
              vizierColumn === columnId ? <BoardVizier key={order} order={order} /> : null,
            )}
          </div>
        ))}
      </div>
      {flight !== null ? <FlyingLeaderCard leader={moment.chosen} flight={flight} /> : null}
    </>
  )
}
