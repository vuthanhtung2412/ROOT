import type { JSX } from 'react'
import { factionTextureKey, imagePathForAssetKey } from '#assets/gameAssets.ts'
import { factionColorCss } from '#game/theme.ts'

/** Create / Join / Start: the one big call to action. */
export const PRIMARY_BUTTON_CLASS_NAME =
  'root-button root-button--accent min-w-50 px-5.5 py-2.5 font-display text-2xl tracking-display'
/** Leave / close, QA shortcut. */
export const SECONDARY_BUTTON_CLASS_NAME =
  'root-button root-button--quiet px-4 py-2 font-display text-lg tracking-display'

/** One seat: a band in the faction colour runs down its left edge. */
export const SEAT_ROW_CLASS_NAME =
  'flex flex-row items-center border border-l-8 border-ink-soft bg-parchment/55 px-3 py-2'

export const SECTION_TITLE_CLASS_NAME =
  'm-0 font-display text-lg tracking-display text-ink'

/** Faction head on a parchment disc ringed in the faction colour. */
export function FactionBadge(props: { factionId: string }): JSX.Element {
  const imagePath: string | null = imagePathForAssetKey(
    factionTextureKey(props.factionId),
  )
  return (
    <span
      className="flex size-9 flex-none items-center justify-center rounded-full border-3 bg-parchment"
      style={{ borderColor: factionColorCss(props.factionId) }}
    >
      {imagePath !== null ? (
        <img
          className="block size-7 object-contain select-none"
          src={imagePath}
          alt=""
          draggable={false}
        />
      ) : null}
    </span>
  )
}
