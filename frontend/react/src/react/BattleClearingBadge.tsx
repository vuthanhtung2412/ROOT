import {
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react'
import { LuSwords } from 'react-icons/lu'
import { factionPortraitPath } from '#assets/factionPortraits.ts'
import type { BattleMark } from '#game/battleOverlayModel.ts'
import { getHudSnapshot, subscribeHud } from '#game/hudStore.ts'
import { factionColorCss } from '#game/theme.ts'

/**
 * Part of the board: above the map, under the dimming behind a battle (z-50),
 * so the battle panel and its backdrop dim it like the rest of the board.
 */
const BADGE_CLASS_NAME =
  'battle-clearing-badge root-paper root-paper-fine pointer-events-none fixed z-10 flex -translate-x-1/2 -translate-y-1/2 flex-row items-center gap-1.5 px-2 py-1.5 text-2xl text-rust [--root-paper-color:var(--color-paper-bright)] md:gap-2 md:text-3xl'
/** Head of one side, framed in its faction colour. */
const SIDE_HEAD_CLASS_NAME =
  'block size-10 rounded-sm border-2 object-cover select-none md:size-12'
const HALF = 0.5

type ScreenPoint = {
  x: number
  y: number
}

/** Middle of a clearing as the map draws it; null while it is not drawn. */
function measureClearingCenter(clearingId: number): ScreenPoint | null {
  const clearing: Element | null = document.querySelector(
    `[data-clearing-id="${String(clearingId)}"]`,
  )
  if (clearing === null) {
    return null
  }
  const bounds: DOMRect = clearing.getBoundingClientRect()
  return {
    x: bounds.left + bounds.width * HALF,
    y: bounds.top + bounds.height * HALF,
  }
}

function samePoint(left: ScreenPoint | null, right: ScreenPoint | null): boolean {
  if (left === null || right === null) {
    return left === right
  }
  return left.x === right.x && left.y === right.y
}

/** The battle clearing on screen, followed through resizes of the map. */
function useClearingCenter(clearingId: number | null): ScreenPoint | null {
  const [center, setCenter] = useState<ScreenPoint | null>(null)
  useLayoutEffect(() => {
    const update = (): void => {
      const measured: ScreenPoint | null =
        clearingId === null ? null : measureClearingCenter(clearingId)
      setCenter((current: ScreenPoint | null) =>
        samePoint(current, measured) ? current : measured,
      )
    }
    update()
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
    }
  }, [clearingId])
  return center
}

function SideHead(props: { faction: string }): JSX.Element | null {
  const headPath: string | null = factionPortraitPath(props.faction)
  if (headPath === null) {
    return null
  }
  return (
    <img
      className={SIDE_HEAD_CLASS_NAME}
      style={{ borderColor: factionColorCss(props.faction) }}
      src={headPath}
      alt={props.faction}
      draggable={false}
    />
  )
}

/**
 * Attacker ⚔ defender on the clearing a battle is fought in, from its first
 * step until its result leaves the screen.
 */
export function BattleClearingBadge(): JSX.Element | null {
  const mark: BattleMark | null = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().battleMark,
    () => getHudSnapshot().battleMark,
  )
  const center: ScreenPoint | null = useClearingCenter(mark?.clearing ?? null)
  if (mark === null || center === null) {
    return null
  }
  return (
    <div
      className={BADGE_CLASS_NAME}
      style={{ left: center.x, top: center.y }}
      role="img"
      aria-label={`${mark.attackerFaction} attacks ${mark.defenderFaction}`}
    >
      <SideHead faction={mark.attackerFaction} />
      <LuSwords aria-hidden="true" />
      <SideHead faction={mark.defenderFaction} />
    </div>
  )
}
