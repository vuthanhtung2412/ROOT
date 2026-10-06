import type { JSX } from 'react'
import { cardImagePublicPath } from '#assets/gameAssets.ts'
import type { LizardBoardViewModel } from '#ui/expansionBoardViewModel.ts'

const REVEALED_FOOTNOTE_CLASS_NAME = 'text-[11px] opacity-80'

/**
 * Cards the Lizard Cult revealed this turn (side of the faction board).
 * Rule: 10.5 — revealed cards stay in the play area; 10.6.1 — back to hand in Evening.
 */
export function RevealedCardsPanel(props: {
  view: LizardBoardViewModel
}): JSX.Element {
  const revealedDefIds: string[] = props.view.revealedDefIds
  return (
    <div
      className="lizard-revealed pointer-events-auto relative z-2 flex size-full flex-col gap-2 overflow-y-auto rounded border border-[rgb(230_220_190/0.35)] bg-[rgb(20_24_18/0.72)] p-2 font-body text-[#f3ecd8]"
      aria-label={`Revealed cards (${String(revealedDefIds.length)})`}
    >
      <div className="flex items-baseline justify-between text-[12px] tracking-heading uppercase opacity-90">
        Revealed
        <span className={REVEALED_FOOTNOTE_CLASS_NAME}>
          {String(revealedDefIds.length)}
        </span>
      </div>
      {revealedDefIds.length === 0 ? (
        <div className={REVEALED_FOOTNOTE_CLASS_NAME}>No revealed cards</div>
      ) : (
        revealedDefIds.map((defId: string, index: number) => {
          const imagePath: string | null = cardImagePublicPath(defId)
          if (imagePath === null) {
            return null
          }
          return (
            <img
              key={`${defId}-${String(index)}`}
              className="block h-auto w-full rounded-md select-none"
              src={imagePath}
              alt="Revealed card"
              draggable={false}
            />
          )
        })
      )}
    </div>
  )
}
