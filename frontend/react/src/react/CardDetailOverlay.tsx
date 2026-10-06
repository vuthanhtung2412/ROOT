import { useSyncExternalStore, type JSX } from 'react'
import {
  cardImagePublicPath,
  imagePathForAssetKey,
  suitTextureKey,
} from '#assets/gameAssets.ts'
import {
  getHudSnapshot,
  patchHud,
  subscribeHud,
  type CardDetailContent,
} from '#game/hudStore.ts'

/** Torn paper sheet: card face on top, name and text under it. */
const PANEL_CLASS_NAME =
  'card-detail-overlay__panel root-paper [--root-paper-color:var(--color-cream)] pointer-events-none z-1 box-border flex w-[min(420px,92vw)] flex-col items-center px-6 pt-5 pb-4 text-center text-ink'
const FACE_CLASS_NAME =
  'card-detail-overlay__face mb-3 block h-77.5 w-55 rounded-md border-3 border-ink-deep object-fill shadow-card select-none'
/** Name row: suit art, card name; a solid rule under it. */
const NAME_ROW_CLASS_NAME =
  'flex w-full flex-row items-center justify-center gap-2 border-b-3 border-ink-deep pb-2'
const SUIT_CLASS_NAME = 'size-7 shrink-0 object-contain'
const NAME_CLASS_NAME =
  'card-detail-overlay__name m-0 font-display text-2xl font-normal text-ink'
const META_CLASS_NAME =
  'card-detail-overlay__meta m-0 mt-2 font-mono text-xs tracking-wide text-ink-soft uppercase'
const BODY_CLASS_NAME =
  'card-detail-overlay__body m-0 mt-2 max-w-90 font-display text-base leading-snug text-ink'
const HINT_CLASS_NAME =
  'card-detail-overlay__hint m-0 mt-3 font-mono text-[11px] text-ink-soft/70'

export function showCardDetail(content: CardDetailContent): void {
  patchHud({ cardDetail: content })
}

export function hideCardDetail(): void {
  if (getHudSnapshot().cardDetail === null) {
    return
  }
  patchHud({ cardDetail: null })
}

export function CardDetailOverlay(): JSX.Element | null {
  const content = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().cardDetail,
    () => getHudSnapshot().cardDetail,
  )
  if (content === null) {
    return null
  }
  const imagePath = cardImagePublicPath(content.defId)
  const suitTexture: string | null = suitTextureKey(content.catalog.suit)
  const suitImagePath: string | null =
    suitTexture !== null ? imagePathForAssetKey(suitTexture) : null
  return (
    <div
      className="card-detail-overlay fixed inset-0 z-400 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="card-detail-overlay__veil absolute inset-0 m-0 cursor-pointer border-0 bg-forest-deep/72 p-0"
        aria-label="Close card detail"
        onClick={() => {
          hideCardDetail()
        }}
      />
      <div className={PANEL_CLASS_NAME}>
        {imagePath !== null ? (
          <img
            className={FACE_CLASS_NAME}
            src={imagePath}
            alt={content.catalog.name}
            draggable={false}
          />
        ) : null}
        <div className={NAME_ROW_CLASS_NAME}>
          {suitImagePath !== null ? (
            <img
              className={SUIT_CLASS_NAME}
              src={suitImagePath}
              alt=""
              draggable={false}
            />
          ) : null}
          <h2 className={NAME_CLASS_NAME}>{content.catalog.name}</h2>
        </div>
        <p className={META_CLASS_NAME}>
          {`${content.catalog.suit} · ${content.catalog.type}`}
        </p>
        <p className={BODY_CLASS_NAME}>{content.catalog.description}</p>
        <p className={HINT_CLASS_NAME}>click to close</p>
      </div>
    </div>
  )
}
