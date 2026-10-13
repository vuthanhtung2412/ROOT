import type { JSX } from 'react'
import { factionTextureKey, imagePathForAssetKey } from '#assets/gameAssets.ts'
import { factionColorCss } from '#game/theme.ts'

/** Create / Join / Start: the one big call to action, green as the confirm tile of a turn. */
export const PRIMARY_BUTTON_CLASS_NAME =
  'root-paper root-paper-press m-0 min-h-15 px-8 py-2.5 font-display text-[28px] tracking-display text-ink-deep [--root-paper-color:var(--color-confirm)]'
/** Dev start, QA shortcut, Add AI: a small paper tile. */
export const SECONDARY_BUTTON_CLASS_NAME =
  'root-paper root-paper-fine root-paper-press m-0 min-h-11 px-5 py-2 font-display text-lg tracking-display text-ink [--root-paper-color:var(--color-parchment-deep)]'
/** A form laid on its own torn sheet. */
export const PAPER_SHEET_CLASS_NAME = 'root-paper w-full max-w-md px-5 py-4'

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
