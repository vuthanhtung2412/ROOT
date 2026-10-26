import type { JSX } from 'react'
import {
  EYRIE_LEADER_CATALOG,
  type EyrieLeaderId,
} from '#assets/eyrieLeaderCatalog.ts'
import { publicAssetUrl } from '#assets/publicAssetUrl.ts'
import type {
  TurmoilDecreeCard,
  TurmoilDecreeColumn,
  TurmoilMoment,
} from '#game/woodlandMoments.ts'
import { FloatingText } from '#react/MapMomentEffects.tsx'
import {
  MomentBanner,
  MomentRibbon,
  MomentStamp,
  momentFactionName,
  SETTLE_EASING,
} from '#react/MomentPaper.tsx'
import { SuitIcon } from '#react/SuitIcon.tsx'
import { useKeyframeSteps, type KeyframeStep } from '#react/useKeyframes.ts'
import type { EyrieDecreeColumnId } from '#ui/factionBoardViewModel.ts'

/** Beats of a turmoil, from its start (ms). */
const BANNER_IN_AT_MS = 150
const DECREE_IN_AT_MS = 700
const DECREE_IN_MS = 450
const FAILED_SHAKE_AT_MS = 1050
const FAILED_SHAKE_MS = 360
const FAILED_SHAKE_PIXELS = 4
const FAILED_SHAKE_SWINGS = 5
const FAILED_MARK_AT_MS = 1150
const FAILED_MARK_MS = 220
const HUMILIATE_AT_MS = 1400
const HUMILIATE_STAGGER_MS = 220
const BIRD_PULSE_MS = 300
const HUMILIATE_STAMP_AT_MS = 2300
const PURGE_AT_MS = 2600
const PURGE_MS = 400
const DEPOSE_AT_MS = 3300
const DEPOSE_FLIP_MS = 600
const DEPOSED_STAMP_AT_MS = 3800
const BANNER_OUT_AT_MS = 4100
export const TURMOIL_MOMENT_MS = 4900

const BIRD_SUIT = 'bird'
const LEADER_BACK_IMAGE_PATH = '/assets/eyrie-leaders/eyrie-leader-back.webp'
const COLUMN_TITLES: Readonly<Record<EyrieDecreeColumnId, string>> = {
  recruit: 'Recruit',
  move: 'Move',
  battle: 'Battle',
  build: 'Build',
}
/** How the failed column's card is told: `Could not Move from a fox clearing`. */
const FAILED_PREPOSITIONS: Readonly<Record<EyrieDecreeColumnId, string>> = {
  recruit: 'in',
  move: 'from',
  battle: 'in',
  build: 'in',
}

const DECREE_PLACE_CLASS_NAME =
  'pointer-events-none fixed top-[58vh] left-1/2 z-261 -translate-1/2'
const DECREE_CLASS_NAME =
  'root-paper relative flex flex-row items-start gap-2 p-3 opacity-0 [--root-paper-color:var(--color-eyrie-deep)] md:gap-3 md:p-4'
const COLUMN_CLASS_NAME =
  'flex min-h-40 w-14 flex-col items-center gap-1.5 rounded-sm bg-black/22 p-1.5 md:min-h-48 md:w-18'
const COLUMN_TITLE_CLASS_NAME =
  'font-display text-xs tracking-wide text-parchment md:text-sm'
const TOKEN_CLASS_NAME =
  'relative flex size-10 items-center justify-center rounded-full border-2 border-ink bg-parchment shadow-card-sm md:size-12'
const VIZIER_TOKEN_CLASS_NAME = `${TOKEN_CLASS_NAME} ring-3 ring-gold`
const FAILED_MARK_CLASS_NAME =
  'absolute inset-0 flex items-center justify-center font-display text-4xl text-rust opacity-0 [text-shadow:0_0_4px_var(--color-parchment)]'
const LEADER_CARD_CLASS_NAME =
  'relative aspect-5/7 w-24 transform-3d md:w-32'
const LEADER_SIDE_CLASS_NAME =
  'absolute inset-0 overflow-hidden rounded-md border border-ink backface-hidden'

function failedReason(moment: TurmoilMoment): string {
  const failed = moment.failedCard
  if (failed === null) {
    return 'The decree could not be carried out'
  }
  const where: string =
    failed.suit === BIRD_SUIT ? 'any clearing' : `a ${failed.suit} clearing`
  return `Could not ${COLUMN_TITLES[failed.columnId]} ${FAILED_PREPOSITIONS[failed.columnId]} ${where}`
}

function shakeKeyframes(): Keyframe[] {
  return Array.from({ length: FAILED_SHAKE_SWINGS + 1 }, (_, index: number) => {
    const swing: number =
      index === FAILED_SHAKE_SWINGS
        ? 0
        : index % 2 === 0
          ? FAILED_SHAKE_PIXELS
          : -FAILED_SHAKE_PIXELS
    return { transform: `translateX(${String(swing)}px)` }
  })
}

type DecreeTokenProps = {
  card: TurmoilDecreeCard
  /** Order of the card among the birds of the decree; null for no bird. */
  birdIndex: number | null
}

function tokenSteps(props: DecreeTokenProps): KeyframeStep[] {
  const steps: KeyframeStep[] = []
  if (props.card.failed) {
    steps.push({
      keyframes: shakeKeyframes(),
      options: { duration: FAILED_SHAKE_MS, delay: FAILED_SHAKE_AT_MS, easing: 'linear' },
    })
  }
  if (props.birdIndex !== null) {
    steps.push({
      keyframes: [{ transform: 'scale(1)' }, { transform: 'scale(1.2)' }, { transform: 'scale(1)' }],
      options: {
        duration: BIRD_PULSE_MS,
        delay: HUMILIATE_AT_MS + props.birdIndex * HUMILIATE_STAGGER_MS,
      },
    })
  }
  if (!props.card.isVizier) {
    steps.push({
      keyframes: [{ opacity: 1 }, { opacity: 0 }],
      options: { duration: PURGE_MS, delay: PURGE_AT_MS, easing: 'ease-out', fill: 'forwards' },
    })
  }
  return steps
}

/** A decree card shown as its suit; viziers wear a gold ring. */
function DecreeToken(props: DecreeTokenProps): JSX.Element {
  const tokenRef = useKeyframeSteps(tokenSteps(props))
  const markRef = useKeyframeSteps([
    {
      keyframes: [
        { opacity: 0, transform: 'scale(2)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      options: { duration: FAILED_MARK_MS, delay: FAILED_MARK_AT_MS, fill: 'both' },
    },
  ])
  return (
    <div
      ref={tokenRef}
      className={props.card.isVizier ? VIZIER_TOKEN_CLASS_NAME : TOKEN_CLASS_NAME}
    >
      <SuitIcon suit={props.card.suit} className="size-3/4 object-contain" />
      {props.card.failed ? (
        <div ref={markRef} className={FAILED_MARK_CLASS_NAME}>
          ✕
        </div>
      ) : null}
      {props.birdIndex !== null ? (
        <div className="absolute top-0 left-1/2">
          <FloatingText
            text="−1"
            delayMs={HUMILIATE_AT_MS + props.birdIndex * HUMILIATE_STAGGER_MS}
            left={0}
            top={0}
          />
        </div>
      ) : null}
    </div>
  )
}

/** The leader card, face up, then turned face down when deposed. */
export function LeaderCard(props: {
  leader: EyrieLeaderId
  flipAtMs: number | null
  faceDown?: boolean
}): JSX.Element {
  const flipRef = useKeyframeSteps(
    props.flipAtMs === null
      ? []
      : [
          {
            keyframes: [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }],
            options: {
              duration: DEPOSE_FLIP_MS,
              delay: props.flipAtMs,
              easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
              fill: 'forwards',
            },
          },
        ],
  )
  const info = EYRIE_LEADER_CATALOG[props.leader]
  return (
    <div
      ref={flipRef}
      className={LEADER_CARD_CLASS_NAME}
      style={props.faceDown === true ? { transform: 'rotateY(180deg)' } : undefined}
    >
      <div className={LEADER_SIDE_CLASS_NAME}>
        <img className="size-full object-cover" src={publicAssetUrl(info.imagePath)} alt={info.name} />
      </div>
      <div className={`${LEADER_SIDE_CLASS_NAME} rotate-y-180 bg-eyrie`}>
        <img className="size-full object-cover" src={publicAssetUrl(LEADER_BACK_IMAGE_PATH)} alt="" />
      </div>
    </div>
  )
}

/** Bird cards in decree order, numbered for the Humiliate beat. */
function birdIndexes(decree: readonly TurmoilDecreeColumn[]): number[][] {
  let birds = 0
  return decree.map((column: TurmoilDecreeColumn): number[] =>
    column.cards.map((card: TurmoilDecreeCard): number => {
      if (card.suit !== BIRD_SUIT) return -1
      birds += 1
      return birds - 1
    }),
  )
}

function TurmoilDecree(props: { moment: TurmoilMoment }): JSX.Element {
  const decreeRef = useKeyframeSteps([
    {
      keyframes: [
        { opacity: 0, transform: 'translateY(24px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      options: { duration: DECREE_IN_MS, delay: DECREE_IN_AT_MS, easing: SETTLE_EASING, fill: 'both' },
    },
  ])
  const indexes: number[][] = birdIndexes(props.moment.decree)
  const deposed: EyrieLeaderId | null = props.moment.deposedLeader
  return (
    <div className={DECREE_PLACE_CLASS_NAME}>
      <div ref={decreeRef} className={DECREE_CLASS_NAME}>
        {deposed !== null ? (
          <div className="relative flex flex-col items-center gap-1.5 perspective-[900px]">
            <span className={`${COLUMN_TITLE_CLASS_NAME} text-gold-light`}>Leader</span>
            <LeaderCard leader={deposed} flipAtMs={DEPOSE_AT_MS} />
            <MomentStamp text="Deposed" atMs={DEPOSED_STAMP_AT_MS} className="top-1/2 left-1/2 -translate-x-1/2" />
          </div>
        ) : null}
        {props.moment.decree.map((column: TurmoilDecreeColumn, columnIndex: number) => (
          <div key={column.columnId} className={COLUMN_CLASS_NAME}>
            <span className={COLUMN_TITLE_CLASS_NAME}>{COLUMN_TITLES[column.columnId]}</span>
            {column.cards.map((card: TurmoilDecreeCard, cardIndex: number) => {
              const birdIndex: number = indexes[columnIndex]?.[cardIndex] ?? -1
              return (
                <DecreeToken
                  key={`${column.columnId}-${String(cardIndex)}`}
                  card={card}
                  birdIndex={birdIndex < 0 ? null : birdIndex}
                />
              )
            })}
          </div>
        ))}
        {props.moment.humiliateLoss > 0 ? (
          <MomentStamp
            text={`−${String(props.moment.humiliateLoss)} VP · Humiliate`}
            atMs={HUMILIATE_STAMP_AT_MS}
            className="-top-5 -right-6"
          />
        ) : null}
      </div>
    </div>
  )
}

/**
 * The Eyrie fall into turmoil: their banner pops in with the failed order,
 * the decree shows as suits, birds cost a point each, the decree is purged
 * but its viziers, and the leader is turned face down.
 */
export function TurmoilMomentView(props: { moment: TurmoilMoment }): JSX.Element {
  const moment: TurmoilMoment = props.moment
  return (
    <>
      <MomentBanner
        faction={moment.faction}
        title="Turmoil"
        reason={failedReason(moment)}
        inAtMs={BANNER_IN_AT_MS}
        outAtMs={BANNER_OUT_AT_MS}
      />
      {moment.decree.length > 0 || moment.humiliateLoss > 0 ? (
        <TurmoilDecree moment={moment} />
      ) : null}
      {moment.deposedLeader !== null ? (
        <MomentRibbon
          text={`${momentFactionName(moment.faction)} are choosing a leader.`}
          atMs={BANNER_OUT_AT_MS}
          holdMs={null}
        />
      ) : null}
    </>
  )
}
