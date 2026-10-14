import type { CSSProperties, JSX } from 'react'
import { factionColorCss } from '#game/theme.ts'

/**
 * Border shape follows the art: discs for tokens/warriors, soft squares for
 * buildings and Vagabond items. Chrome (white edge + faction fill) is shared.
 */
export type RemovalPickOptionShape = 'item' | 'token' | 'building'

/** Soft square chrome — buildings and item tiles share this. */
const SQUARE_TILE_CLASS_NAME = 'rounded border-[1.5px] border-white'
const BASE_CLASS_NAME =
  'removal-pick-option relative m-0 box-border size-14 cursor-root-pointer p-0 transition-[transform,border-color,box-shadow] duration-75 ease-out md:size-16'
const SHAPE_CLASS_NAME: Readonly<Record<RemovalPickOptionShape, string>> = {
  item: SQUARE_TILE_CLASS_NAME,
  token: 'rounded-full border-[1.5px] border-white',
  building: SQUARE_TILE_CLASS_NAME,
}
const IMAGE_SHAPE_CLASS_NAME: Readonly<Record<RemovalPickOptionShape, string>> =
  {
    item: 'rounded',
    token: 'rounded-full',
    building: 'rounded',
  }
const SELECTED_CLASS_NAME = 'border-gold -translate-y-1 shadow-gold-ring'
const EXHAUSTED_IMAGE_CLASS_NAME = 'opacity-40'
const CHECK_BADGE_CLASS_NAME =
  'pointer-events-none absolute -top-2 -right-2 z-2 flex size-5 items-center justify-center rounded-full border border-ink bg-gold font-mono text-xs text-ink'
const DAMAGED_BADGE_CLASS_NAME =
  'pointer-events-none absolute right-0 bottom-0 left-0 z-2 bg-ink/80 text-center font-mono text-[9px] leading-tight text-parchment'
const IMAGE_CLASS_NAME =
  'pointer-events-none relative z-1 block size-full object-cover select-none'
const DEFAULT_TILE_BACKGROUND = 'var(--color-parchment)'

/**
 * Click-to-toggle artwork tile used for Vagabond items and battle piece removal.
 * Selected: gold ring + lift + check badge (same UX for every faction).
 * Background fill = owning faction colour.
 */
export function RemovalPickOption(props: {
  label: string
  imagePath: string | null
  shape: RemovalPickOptionShape
  selected: boolean
  exhausted?: boolean
  damaged?: boolean
  disabled?: boolean
  /** Owning faction — fills the tile behind the art. */
  factionId?: string
  fallbackText: string
  onPick: () => void
}): JSX.Element {
  const shapeClass = SHAPE_CLASS_NAME[props.shape]
  const selectedClass = props.selected ? SELECTED_CLASS_NAME : ''
  const imageShapeClass = IMAGE_SHAPE_CLASS_NAME[props.shape]
  const backgroundColor =
    props.factionId !== undefined
      ? factionColorCss(props.factionId)
      : DEFAULT_TILE_BACKGROUND
  const buttonStyle: CSSProperties = { backgroundColor }

  return (
    <button
      type="button"
      className={`${BASE_CLASS_NAME} ${shapeClass} ${selectedClass}`}
      style={buttonStyle}
      aria-label={props.label}
      aria-pressed={props.selected}
      title={props.label}
      disabled={props.disabled === true}
      onClick={props.onPick}
    >
      {props.imagePath !== null ? (
        <img
          className={`${IMAGE_CLASS_NAME} ${imageShapeClass} ${
            props.exhausted === true ? EXHAUSTED_IMAGE_CLASS_NAME : ''
          }`}
          src={props.imagePath}
          alt={props.fallbackText}
          draggable={false}
        />
      ) : (
        <span className="relative z-1 font-mono text-xs text-ink">
          {props.fallbackText}
        </span>
      )}
      {props.damaged === true ? (
        <span className={DAMAGED_BADGE_CLASS_NAME}>damaged</span>
      ) : null}
      {props.selected ? (
        <span className={CHECK_BADGE_CLASS_NAME} aria-hidden="true">
          ✓
        </span>
      ) : null}
    </button>
  )
}

/** Map piece kind → tile border shape. */
export function removalPickShapeForPieceKind(
  kind: string,
): RemovalPickOptionShape {
  if (kind === 'token' || kind === 'warrior' || kind === 'pawn') {
    return 'token'
  }
  if (kind === 'building') {
    return 'building'
  }
  return 'item'
}
