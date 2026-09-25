import { useSyncExternalStore, type JSX } from 'react'
import { cardImagePublicPath } from '#assets/gameAssets.ts'
import {
  getHudSnapshot,
  patchHud,
  subscribeHud,
  type CardDetailContent,
} from '#game/hudStore.ts'
import '#react/CardDetailOverlay.css'

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
  return (
    <div className="card-detail-overlay" role="dialog" aria-modal="true">
      <button
        type="button"
        className="card-detail-overlay__veil"
        aria-label="Close card detail"
        onClick={() => {
          hideCardDetail()
        }}
      />
      <div className="card-detail-overlay__panel">
        {imagePath !== null ? (
          <img
            className="card-detail-overlay__face"
            src={imagePath}
            alt={content.catalog.name}
            draggable={false}
          />
        ) : null}
        <h2 className="card-detail-overlay__name">{content.catalog.name}</h2>
        <p className="card-detail-overlay__meta">
          {`${content.catalog.suit} · ${content.catalog.type}`}
        </p>
        <p className="card-detail-overlay__body">{content.catalog.description}</p>
        <p className="card-detail-overlay__hint">click to close</p>
      </div>
    </div>
  )
}
