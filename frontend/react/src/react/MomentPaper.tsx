import type { JSX } from 'react'
import { factionPortraitPath } from '#assets/factionPortraits.ts'
import { useKeyframeSteps, type KeyframeStep } from '#react/useKeyframes.ts'

/**
 * Torn-paper pieces of the woodland moments: the faction banner that pops
 * in and out, the parchment strip under the turn banner, and rust stamps.
 */

const BANNER_POP_IN_MS = 380
const BANNER_POP_OUT_MS = 300
const BANNER_POP_IN_EASING = 'cubic-bezier(0.34, 1.4, 0.64, 1)'
const RIBBON_DROP_MS = 420
const RIBBON_LIFT_MS = 350
const STAMP_MS = 320
const STAMP_EASING = 'cubic-bezier(0.5, 0, 0.75, 0)'
export const SETTLE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'

/** Faction-coloured paper of each banner, like the bot banner head. */
const BANNER_COLOR_CLASS_NAMES: Readonly<Record<string, string>> = {
  eyrie: '[--root-paper-color:var(--color-eyrie)]',
  electricEyrie: '[--root-paper-color:var(--color-eyrie)]',
  alliance: '[--root-paper-color:var(--color-alliance)]',
  vagabond: '[--root-paper-color:var(--color-vagabond)]',
}
const NEUTRAL_BANNER_COLOR_CLASS_NAME = '[--root-paper-color:var(--color-wood)]'
const BANNER_PLACE_CLASS_NAME =
  'pointer-events-none fixed top-[16vh] left-1/2 z-261 -translate-x-1/2'
const BANNER_CLASS_NAME =
  'root-paper flex flex-row items-center gap-4 py-3 pr-10 pl-4 text-parchment opacity-0 md:gap-5 md:pr-14'
const BANNER_PORTRAIT_CLASS_NAME =
  'root-paper root-paper-fine -my-4 size-20 shrink-0 -rotate-4 p-1 [--root-paper-color:var(--color-paper-bright)] md:size-24'
const BANNER_TITLE_CLASS_NAME =
  'font-display text-4xl leading-none tracking-wide [text-shadow:1px_1px_0_rgb(44_33_24/0.55)] md:text-6xl'
const BANNER_REASON_CLASS_NAME = 'font-body text-sm opacity-85 md:text-lg'
const RIBBON_PLACE_CLASS_NAME =
  'pointer-events-none fixed top-16 left-1/2 z-261 -translate-x-1/2 md:top-18'
const RIBBON_CLASS_NAME =
  'root-paper px-6 py-1.5 font-display text-lg whitespace-nowrap text-ink opacity-0 md:text-2xl'
const STAMP_CLASS_NAME =
  'root-paper root-paper-fine absolute z-3 px-3 py-1 font-display text-xl whitespace-nowrap text-parchment opacity-0 [--root-paper-color:var(--color-rust)] md:text-2xl'
const STAMP_TILT = 'rotate(-4deg)'

type MomentBannerProps = {
  faction: string
  title: string
  reason: string
  /** When the banner pops in and out, from the moment's start (ms). */
  inAtMs: number
  outAtMs: number
  /** Extra paper class names (a torn chip corner). */
  className?: string
}

function bannerSteps(inAtMs: number, outAtMs: number): KeyframeStep[] {
  return [
    {
      keyframes: [
        { opacity: 0, transform: 'scale(0.3)' },
        { opacity: 1, transform: 'scale(1.12)', offset: 0.65 },
        { opacity: 1, transform: 'scale(1)' },
      ],
      options: {
        duration: BANNER_POP_IN_MS,
        delay: inAtMs,
        easing: BANNER_POP_IN_EASING,
        fill: 'both',
      },
    },
    {
      keyframes: [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 1, transform: 'scale(1.08)', offset: 0.3 },
        { opacity: 0, transform: 'scale(0.3)' },
      ],
      options: {
        duration: BANNER_POP_OUT_MS,
        delay: outAtMs,
        easing: 'ease-in',
        fill: 'forwards',
      },
    },
  ]
}

/** The faction's banner: portrait tile, big title, the reason under it. */
export function MomentBanner(props: MomentBannerProps): JSX.Element {
  const bannerRef = useKeyframeSteps(bannerSteps(props.inAtMs, props.outAtMs))
  const portraitPath: string | null = factionPortraitPath(props.faction)
  const colorClassName: string =
    BANNER_COLOR_CLASS_NAMES[props.faction] ?? NEUTRAL_BANNER_COLOR_CLASS_NAME
  return (
    <div className={BANNER_PLACE_CLASS_NAME}>
      <div
        ref={bannerRef}
        className={`${BANNER_CLASS_NAME} ${colorClassName} ${props.className ?? ''}`}
      >
        {portraitPath !== null ? (
          <span className={BANNER_PORTRAIT_CLASS_NAME}>
            <img
              className="block size-full rounded-sm object-cover"
              src={portraitPath}
              alt=""
            />
          </span>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <span className={BANNER_TITLE_CLASS_NAME}>{props.title}</span>
          <span className={BANNER_REASON_CLASS_NAME}>{props.reason}</span>
        </div>
      </div>
    </div>
  )
}

type MomentRibbonProps = {
  text: string
  atMs: number
  /** How long it stays down; null = until the moment ends. */
  holdMs: number | null
}

function ribbonSteps(atMs: number, holdMs: number | null): KeyframeStep[] {
  const drop: KeyframeStep = {
    keyframes: [
      { opacity: 0, transform: 'translateY(-200%)' },
      { opacity: 1, transform: 'translateY(12%)', offset: 0.7 },
      { opacity: 1, transform: 'translateY(0)' },
    ],
    options: {
      duration: RIBBON_DROP_MS,
      delay: atMs,
      easing: SETTLE_EASING,
      fill: 'both',
    },
  }
  if (holdMs === null) {
    return [drop]
  }
  return [
    drop,
    {
      keyframes: [
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(-200%)' },
      ],
      options: {
        duration: RIBBON_LIFT_MS,
        delay: atMs + holdMs,
        easing: 'ease-in',
        fill: 'forwards',
      },
    },
  ]
}

/** The parchment strip under the turn banner, telling what happens. */
export function MomentRibbon(props: MomentRibbonProps): JSX.Element {
  const ribbonRef = useKeyframeSteps(ribbonSteps(props.atMs, props.holdMs))
  return (
    <div className={RIBBON_PLACE_CLASS_NAME}>
      <div ref={ribbonRef} className={RIBBON_CLASS_NAME}>
        {props.text}
      </div>
    </div>
  )
}

type MomentStampProps = {
  text: string
  atMs: number
  /** Where the stamp lands, in its positioned parent. */
  className: string
}

/** A small rust tile slammed down onto the paper. */
export function MomentStamp(props: MomentStampProps): JSX.Element {
  const stampRef = useKeyframeSteps([
    {
      keyframes: [
        { opacity: 0, transform: `${STAMP_TILT} scale(2.2)` },
        { opacity: 1, transform: `${STAMP_TILT} scale(0.92)`, offset: 0.7 },
        { opacity: 1, transform: `${STAMP_TILT} scale(1)` },
      ],
      options: {
        duration: STAMP_MS,
        delay: props.atMs,
        easing: STAMP_EASING,
        fill: 'both',
      },
    },
  ])
  return (
    <div ref={stampRef} className={`${STAMP_CLASS_NAME} ${props.className}`}>
      {props.text}
    </div>
  )
}

const MOMENT_FACTION_NAMES: Readonly<Record<string, string>> = {
  eyrie: 'Eyrie',
  electricEyrie: 'Electric Eyrie',
  alliance: 'Woodland Alliance',
  vagabond: 'Vagabond',
}

/** Faction name as a moment tells it (`Eyrie`, `Vagabond`). */
export function momentFactionName(faction: string): string {
  return MOMENT_FACTION_NAMES[faction] ?? faction
}
