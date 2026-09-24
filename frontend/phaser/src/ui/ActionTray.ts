import type Phaser from 'phaser'
import type { ActionSpec, GameState } from '#api/client.ts'
import { lookupCardCatalog } from '#assets/gameAssets.ts'
import { readChoiceParams } from '#game/ActionComposer.ts'
import { gameViewSize } from '#game/hiDpi.ts'

export type ActionTrayHandlers = {
  onSelectAction: (spec: ActionSpec) => void
}

export type ActionTraySyncOptions = {
  lockToActionTypes?: readonly string[]
  /** Hide tray and clear buttons (e.g. while march is staged). */
  disabled?: boolean
}

const ACTION_TRAY_TITLE_FONT_SIZE_PIXELS = 20
const ACTION_TRAY_BUTTON_FONT_SIZE_PIXELS = 18
const ACTION_TRAY_ROOT_X_FROM_RIGHT_PIXELS = 260
const ACTION_TRAY_ROOT_Y_PIXELS = 64
const ACTION_TRAY_FIRST_BUTTON_Y_PIXELS = 36
const ACTION_TRAY_BUTTON_ROW_HEIGHT_PIXELS = 42
const ACTION_TRAY_DISABLED_SYNC_KEY = '__disabled__'

/** Lists legal ActionSpecs for the current prompt actor. */
export class ActionTray {
  private readonly scene: Phaser.Scene
  private readonly root: Phaser.GameObjects.Container
  private readonly title: Phaser.GameObjects.Text
  private buttonNodes: Phaser.GameObjects.GameObject[] = []
  private handlers: ActionTrayHandlers
  private lastSyncKey: string | null = null

  constructor(scene: Phaser.Scene, handlers: ActionTrayHandlers) {
    this.scene = scene
    this.handlers = handlers
    const { width } = gameViewSize()
    this.title = scene.add.text(0, 0, 'Actions', {
      fontFamily: 'Georgia, serif',
      fontSize: `${String(ACTION_TRAY_TITLE_FONT_SIZE_PIXELS)}px`,
      color: '#f0e6d3',
      backgroundColor: '#0a0a0add',
      padding: { x: 10, y: 5 },
    })
    this.root = scene.add
      .container(
        width - ACTION_TRAY_ROOT_X_FROM_RIGHT_PIXELS,
        ACTION_TRAY_ROOT_Y_PIXELS,
        [this.title],
      )
      .setDepth(110)
  }

  setHandlers(handlers: ActionTrayHandlers): void {
    this.handlers = handlers
  }

  sync(
    actions: readonly ActionSpec[],
    actorSeat: number,
    pending?: unknown,
    options?: ActionTraySyncOptions,
    state?: GameState,
  ): void {
    if (options?.disabled === true) {
      if (this.lastSyncKey === ACTION_TRAY_DISABLED_SYNC_KEY) {
        return
      }
      this.lastSyncKey = ACTION_TRAY_DISABLED_SYNC_KEY
      for (const node of this.buttonNodes) {
        node.destroy()
      }
      this.buttonNodes = []
      this.root.setVisible(false)
      return
    }
    this.root.setVisible(true)

    const forActor = filterTrayActions(actions, actorSeat, options)
    const syncKey = JSON.stringify(
      forActor.map((spec) => ({
        type: spec.type,
        actor: spec.actor,
        params: spec.params,
        label: formatActionLabel(spec, pending, state),
      })),
    )
    if (syncKey === this.lastSyncKey) {
      return
    }
    this.lastSyncKey = syncKey

    for (const node of this.buttonNodes) {
      node.destroy()
    }
    this.buttonNodes = []

    this.title.setText(`Actions (${String(forActor.length)})`)

    forActor.forEach((spec, index) => {
      const button = this.scene.add
        .text(
          0,
          ACTION_TRAY_FIRST_BUTTON_Y_PIXELS +
            index * ACTION_TRAY_BUTTON_ROW_HEIGHT_PIXELS,
          formatActionLabel(spec, pending, state),
          {
            fontFamily: 'monospace',
            fontSize: `${String(ACTION_TRAY_BUTTON_FONT_SIZE_PIXELS)}px`,
            color: '#1a1a1a',
            backgroundColor: '#f0e6d3',
            padding: { x: 12, y: 8 },
          },
        )
        .setInteractive({ useHandCursor: true })

      button.on('pointerdown', () => {
        this.handlers.onSelectAction(spec)
      })

      this.root.add(button)
      this.buttonNodes.push(button)
    })
  }

  destroy(): void {
    this.root.destroy(true)
  }
}

const VIZIER_DEF_ID = 'VIZIER'

function formatActionLabel(
  spec: ActionSpec,
  pending?: unknown,
  state?: GameState,
): string {
  const params = readChoiceParams(spec)
  const pendingType =
    typeof pending === 'object' && pending !== null
      ? Reflect.get(pending, 'type')
      : undefined
  if (spec.type === 'decree') {
    const column = params.column?.[0]
    const cardId = params.cardIds?.[0]
    const suit = cardId !== undefined ? decreeCardSuit(cardId, state) : null
    if (column !== undefined && suit !== null) {
      return `decree:${column} (${suit})`
    }
    return column !== undefined ? `decree:${column}` : 'decree'
  }
  if (spec.type === 'resolveEvent') {
    const startingBuilding = params.building?.[0]
    if (startingBuilding !== undefined) {
      return `place ${startingBuilding}`
    }
    if (params.clearing !== undefined) {
      return 'choose keep'
    }
    if (params.leaders !== undefined) {
      return 'choose leader'
    }
    if (pendingType === 'fieldHospital') {
      if (params.decline !== undefined) {
        return 'Decline Field Hospitals'
      }
      if (params.cardIds !== undefined) {
        return 'Field Hospitals: pay'
      }
    }
    if (params.decline !== undefined) {
      return 'skip ambush'
    }
    if (params.cardIds !== undefined) {
      return 'play ambush'
    }
    if (params.pieceIds !== undefined) {
      return `remove hits`
    }
    if (params.useEffect !== undefined) {
      const only = params.useEffect[0]
      if (params.useEffect.length === 1 && only === true) {
        return 'use effect'
      }
      if (params.useEffect.length === 1 && only === false) {
        return 'skip effect'
      }
      return 'battle effect'
    }
    if (params.order !== undefined) {
      return 'effects order'
    }
    return 'resolveEvent'
  }
  return spec.type
}

function decreeCardSuit(cardId: string, state?: GameState): string | null {
  const fromState = findCardDefIdInState(cardId, state)
  const defId = fromState ?? parseDefIdFromCardId(cardId)
  if (defId === null) {
    return null
  }
  if (defId === VIZIER_DEF_ID) {
    return 'bird'
  }
  return lookupCardCatalog(defId)?.suit ?? null
}

function parseDefIdFromCardId(cardId: string): string | null {
  const hashIndex = cardId.indexOf('#')
  if (hashIndex <= 0) {
    return null
  }
  return cardId.slice(0, hashIndex)
}

function findCardDefIdInState(cardId: string, state?: GameState): string | null {
  if (state === undefined) {
    return null
  }
  for (const player of state.players) {
    for (const card of player.hand) {
      if (card.id === cardId) {
        return card.defId
      }
    }
    const defIdFromBoard = findCardDefIdOnEyrieDecree(player.board, cardId)
    if (defIdFromBoard !== null) {
      return defIdFromBoard
    }
  }
  return null
}

function findCardDefIdOnEyrieDecree(board: unknown, cardId: string): string | null {
  if (typeof board !== 'object' || board === null) {
    return null
  }
  if (Reflect.get(board, 'kind') !== 'eyrie') {
    return null
  }
  const decree = Reflect.get(board, 'decree')
  if (typeof decree !== 'object' || decree === null) {
    return null
  }
  for (const columnCards of Object.values(decree)) {
    if (!Array.isArray(columnCards)) {
      continue
    }
    for (const entry of columnCards) {
      if (typeof entry !== 'object' || entry === null) {
        continue
      }
      const id = Reflect.get(entry, 'id')
      const defId = Reflect.get(entry, 'defId')
      if (id === cardId && typeof defId === 'string') {
        return defId
      }
    }
  }
  return null
}

export function filterTrayActions(
  actions: readonly ActionSpec[],
  actorSeat: number,
  options?: ActionTraySyncOptions,
): ActionSpec[] {
  if (options?.disabled === true) {
    return []
  }
  const lockTypes = options?.lockToActionTypes
  return actions.filter((spec) => {
    if (spec.actor !== actorSeat) {
      return false
    }
    if (lockTypes !== undefined && !lockTypes.includes(spec.type)) {
      return false
    }
    return true
  })
}

/** Exported for unit tests. */
export { formatActionLabel }
