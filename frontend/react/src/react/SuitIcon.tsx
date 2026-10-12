import type { JSX } from 'react'
import { imagePathForAssetKey, suitTextureKey } from '#assets/gameAssets.ts'

const BIRD_SUIT = 'bird'
/** The pale bird suit is lost on paper: an ink line follows its shape. */
const BIRD_OUTLINE_CLASS_NAME =
  '[filter:drop-shadow(1px_0_0_var(--color-ink-deep))_drop-shadow(-1px_0_0_var(--color-ink-deep))_drop-shadow(0_1px_0_var(--color-ink-deep))_drop-shadow(0_-1px_0_var(--color-ink-deep))]'

export type SuitIconProps = {
  suit: string
  /** Size and layout of the image. */
  className: string
  /** Empty when a label nearby already names the suit. */
  alt?: string
  /** The ink line around the bird suit; on unless turned off. */
  isOutlined?: boolean
}

/** A suit drawn as its icon; null for an unknown suit. */
export function SuitIcon(props: SuitIconProps): JSX.Element | null {
  const textureKey: string | null = suitTextureKey(props.suit)
  const imagePath: string | null =
    textureKey !== null ? imagePathForAssetKey(textureKey) : null
  if (imagePath === null) {
    return null
  }
  const isOutlined: boolean =
    props.suit === BIRD_SUIT && props.isOutlined !== false
  return (
    <img
      className={
        isOutlined
          ? `${props.className} ${BIRD_OUTLINE_CLASS_NAME}`
          : props.className
      }
      src={imagePath}
      alt={props.alt ?? ''}
      draggable={false}
    />
  )
}
