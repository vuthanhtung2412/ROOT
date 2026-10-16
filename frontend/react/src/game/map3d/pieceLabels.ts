import { Group, Sprite, SpriteMaterial } from 'three'
import {
  colorToCss,
  createBadgeTexture,
  createIconTexture,
} from '#game/map3d/iconTexture.ts'

/** What the 2D label of a piece is drawn from. */
export type PieceLabelRequest = {
  texturePath: string | null
  /** Faction colour, 0xRRGGBB. */
  color: number
  count: number
  /** A building: its square icon gets rounded corners. */
  isBuilding?: boolean
}

export type PieceLabels = {
  /** The 2D token icon, with the stack size pinned on its corner. */
  createLabel: (request: PieceLabelRequest) => Group
  dispose: () => void
}

/** Icons draw over the woodland, badges over the icons. */
const LABEL_RENDER_ORDER = 9
const BADGE_RENDER_ORDER = 10
/** Badge, relative to its icon: half its size, on its top right corner. */
const BADGE_RELATIVE_SIZE = 0.5
const BADGE_SPRITE_CENTER = -0.3
const UNTINTED_COLOR = 0xffffff

/** Makes piece labels; pieces that look alike share their materials. */
export function createPieceLabels(): PieceLabels {
  const iconMaterials: Map<string, SpriteMaterial> = new Map<
    string,
    SpriteMaterial
  >()
  const badgeMaterials: Map<string, SpriteMaterial> = new Map<
    string,
    SpriteMaterial
  >()

  const iconMaterial = (request: PieceLabelRequest): SpriteMaterial => {
    const roundedCorners: boolean = request.isBuilding === true
    const materialKey: string = `${request.texturePath ?? colorToCss(request.color)}:${String(roundedCorners)}`
    const cached: SpriteMaterial | undefined = iconMaterials.get(materialKey)
    if (cached !== undefined) {
      return cached
    }
    const material: SpriteMaterial = new SpriteMaterial({
      color: request.texturePath === null ? request.color : UNTINTED_COLOR,
      depthTest: false,
    })
    if (request.texturePath !== null) {
      material.map = createIconTexture({
        imagePath: request.texturePath,
        roundedCorners,
      })
    }
    iconMaterials.set(materialKey, material)
    return material
  }

  const badgeMaterial = (request: PieceLabelRequest): SpriteMaterial => {
    const materialKey: string = `${String(request.count)}:${String(request.color)}`
    const cached: SpriteMaterial | undefined = badgeMaterials.get(materialKey)
    if (cached !== undefined) {
      return cached
    }
    const material: SpriteMaterial = new SpriteMaterial({
      map: createBadgeTexture(request.count, request.color),
      depthTest: false,
    })
    badgeMaterials.set(materialKey, material)
    return material
  }

  return {
    createLabel: (request: PieceLabelRequest): Group => {
      const label: Group = new Group()
      const icon: Sprite = new Sprite(iconMaterial(request))
      icon.renderOrder = LABEL_RENDER_ORDER
      label.add(icon)
      if (request.count > 1) {
        const badge: Sprite = new Sprite(badgeMaterial(request))
        badge.scale.setScalar(BADGE_RELATIVE_SIZE)
        // Anchored off-centre, so it sits on the icon's corner on screen.
        badge.center.set(BADGE_SPRITE_CENTER, BADGE_SPRITE_CENTER)
        badge.renderOrder = BADGE_RENDER_ORDER
        label.add(badge)
      }
      return label
    },
    dispose: (): void => {
      for (const material of [
        ...iconMaterials.values(),
        ...badgeMaterials.values(),
      ]) {
        material.map?.dispose()
        material.dispose()
      }
    },
  }
}
