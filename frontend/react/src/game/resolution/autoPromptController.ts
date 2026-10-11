import type { ActionSpec } from '#api/client.ts'
import {
  readChoiceParams,
  type ActionComposer,
  type ComposerOutcome,
} from '#game/resolution/ActionComposer.ts'
import type { BattleRemovalStepperChoice } from '#game/battleRemovalStepper.ts'
import {
  buildBattleRemovalStepperChoices,
  buildPiecesByIdFromClearings,
  collectPieceIdsCombosFromSpecs,
  isPieceIdsRemovalSpec,
} from '#game/battleRemovalStepper.ts'
import {
  battleAmbushRole,
  fieldHospitalCardIdsFromSpecs,
  isBattleRemovalPending,
  isFieldHospitalPending,
} from '#game/resolution/eventActionComposer.ts'
import { pendingEventType } from '#game/expansionPendingPrompts.ts'
import { soleEndPhaseAction } from '#game/resolution/forcedAction.ts'
import {
  FORCED_CARD_ACTION_TYPES,
  FORCED_CARD_PENDING_TYPES,
} from '#game/resolution/optionActionFlows.ts'
import type { GameSessionSnapshot } from '#game/GameSession.ts'

export type EventComposerAutoPromptHooks = {
  beginFieldHospital: (cardIds: readonly string[]) => ComposerOutcome
  beginAmbush: (
    cardIds: readonly string[],
    role: 'ambush' | 'foil',
  ) => ComposerOutcome
  beginBattleRemoval: (
    choices: BattleRemovalStepperChoice[],
  ) => ComposerOutcome
}

export type AutoPromptControllerDeps = {
  applyComposerOutcome: (outcome: ComposerOutcome) => void
  composer: ActionComposer
  eventComposer: EventComposerAutoPromptHooks
  submitEndPhase: () => void
  /** While battle result strip is showing, defer auto endPhase. */
  isBattleResultFlashActive: () => boolean
  /** Setup keep/building highlights need BoardView; skip until ready. */
  isBoardReady: () => boolean
}

/**
 * Opens forced prompts / sole endPhase without tray clicks.
 * Dedupes by pending+actions key so HUD repaints do not re-open.
 */
export class AutoPromptController {
  private fieldHospitalKey: string | null = null
  private ambushKey: string | null = null
  private battleRemovalKey: string | null = null
  private setupPromptKey: string | null = null
  private forcedCardPromptKey: string | null = null
  private endPhaseKey: string | null = null
  private itemDamageKey: string | null = null

  constructor(private readonly deps: AutoPromptControllerDeps) {}

  runAfterHudPaint(
    snapshot: GameSessionSnapshot,
    actorSeat: number,
    localControlsActor: boolean,
  ): void {
    // Log-replay QA: the script posts the logged acts; no sole-endPhase / prompts.
    if (window.__ROOT_QA_DISABLE_AUTO__ === true) {
      return
    }
    this.maybeBeginSetupPrompt(snapshot, actorSeat, localControlsActor)
    this.maybeBeginForcedCardPrompt(snapshot, actorSeat, localControlsActor)
    this.maybeBeginFieldHospitalPrompt(snapshot, actorSeat, localControlsActor)
    this.maybeBeginAmbushPrompt(snapshot, actorSeat, localControlsActor)
    this.maybeBeginBattleRemoval(snapshot, actorSeat, localControlsActor)
    this.maybeBeginItemDamagePrompt(snapshot, actorSeat, localControlsActor)
    this.maybeAutoEndPhase(snapshot, actorSeat, localControlsActor)
  }

  private maybeBeginFieldHospitalPrompt(
    snapshot: GameSessionSnapshot,
    actorSeat: number,
    localControlsActor: boolean,
  ): void {
    if (!localControlsActor || snapshot.state === null) {
      this.fieldHospitalKey = null
      return
    }
    const pending = snapshot.state.pending[0]
    if (!isFieldHospitalPending(pending)) {
      this.fieldHospitalKey = null
      return
    }
    const forActor = snapshot.legalActions.filter(
      (spec) => spec.type === 'resolveEvent' && spec.actor === actorSeat,
    )
    if (forActor.length === 0) {
      this.fieldHospitalKey = null
      return
    }
    const key = JSON.stringify({ pending, actions: forActor })
    if (key === this.fieldHospitalKey) {
      return
    }
    this.fieldHospitalKey = key
    const cardIds = fieldHospitalCardIdsFromSpecs(forActor)
    this.deps.applyComposerOutcome(
      this.deps.composer.adopt(
        this.deps.eventComposer.beginFieldHospital(cardIds),
      ),
    )
  }

  private maybeBeginAmbushPrompt(
    snapshot: GameSessionSnapshot,
    actorSeat: number,
    localControlsActor: boolean,
  ): void {
    if (!localControlsActor || snapshot.state === null) {
      this.ambushKey = null
      return
    }
    const pending = snapshot.state.pending[0]
    const role = battleAmbushRole(pending)
    if (role === null) {
      this.ambushKey = null
      return
    }
    const forActor = snapshot.legalActions.filter(
      (spec) => spec.type === 'resolveEvent' && spec.actor === actorSeat,
    )
    if (forActor.length === 0) {
      this.ambushKey = null
      return
    }
    const key = JSON.stringify({ pending, actions: forActor, kind: 'ambush' })
    if (key === this.ambushKey) {
      return
    }
    this.ambushKey = key
    const cardIds = fieldHospitalCardIdsFromSpecs(forActor)
    this.deps.applyComposerOutcome(
      this.deps.composer.adopt(
        this.deps.eventComposer.beginAmbush(cardIds, role),
      ),
    )
  }

  private maybeBeginBattleRemoval(
    snapshot: GameSessionSnapshot,
    actorSeat: number,
    localControlsActor: boolean,
  ): void {
    if (!localControlsActor || snapshot.state === null) {
      this.battleRemovalKey = null
      return
    }
    const pending = snapshot.state.pending[0]
    if (!isBattleRemovalPending(pending)) {
      this.battleRemovalKey = null
      return
    }
    const removalSpecs = snapshot.legalActions.filter(
      (action) =>
        isPieceIdsRemovalSpec(action) && action.actor === actorSeat,
    )
    if (removalSpecs.length === 0) {
      this.battleRemovalKey = null
      return
    }
    const key = JSON.stringify({
      pending,
      actions: removalSpecs,
      kind: 'removal',
    })
    if (key === this.battleRemovalKey) {
      return
    }
    this.battleRemovalKey = key
    const combos = collectPieceIdsCombosFromSpecs(removalSpecs)
    const piecesById = buildPiecesByIdFromClearings(snapshot.state.clearings)
    const choices = buildBattleRemovalStepperChoices(combos, piecesById)
    this.deps.applyComposerOutcome(
      this.deps.composer.adopt(
        this.deps.eventComposer.beginBattleRemoval(choices),
      ),
    )
  }

  /** Rule: 9.2.6 — open the Vagabond item-damage choice without a tray click. */
  private maybeBeginItemDamagePrompt(
    snapshot: GameSessionSnapshot,
    actorSeat: number,
    localControlsActor: boolean,
  ): void {
    if (!localControlsActor || snapshot.state === null) {
      this.itemDamageKey = null
      return
    }
    const itemDamageSpec = snapshot.legalActions.find(
      (spec: ActionSpec) =>
        (spec.type === 'resolveEvent' || spec.type === 'vbRemoveItems') &&
        spec.actor === actorSeat &&
        readChoiceParams(spec).vagabondItems !== undefined,
    )
    if (itemDamageSpec === undefined) {
      this.itemDamageKey = null
      return
    }
    const key = JSON.stringify({
      pending: snapshot.state.pending[0],
      params: itemDamageSpec.params,
    })
    if (key === this.itemDamageKey) {
      return
    }
    this.itemDamageKey = key
    this.deps.applyComposerOutcome(this.deps.composer.begin(itemDamageSpec))
  }

  private maybeAutoEndPhase(
    snapshot: GameSessionSnapshot,
    actorSeat: number,
    localControlsActor: boolean,
  ): void {
    if (!localControlsActor || snapshot.state === null) {
      this.endPhaseKey = null
      return
    }
    if (snapshot.state.pending.length > 0) {
      this.endPhaseKey = null
      return
    }
    if (this.deps.isBattleResultFlashActive()) {
      // Leave endPhaseKey unset so flash-end can retry.
      return
    }
    const sole = soleEndPhaseAction(snapshot.legalActions, actorSeat)
    if (sole === null) {
      this.endPhaseKey = null
      return
    }
    const key = JSON.stringify({
      turn: snapshot.state.turn,
      phase: snapshot.state.phase,
      step: snapshot.state.step,
      seat: actorSeat,
    })
    if (key === this.endPhaseKey) {
      return
    }
    this.endPhaseKey = key
    this.deps.submitEndPhase()
  }

  /**
   * A crafted card forces a choice: a pending event (Swap Meet: card to give)
   * or a forced turn action (Eyrie Émigré: move at the end of Birdsong).
   */
  private maybeBeginForcedCardPrompt(
    snapshot: GameSessionSnapshot,
    actorSeat: number,
    localControlsActor: boolean,
  ): void {
    const pending: unknown = snapshot.state?.pending[0]
    const pendingType: string | null = pendingEventType(pending)
    const answersForcedPending: boolean =
      pendingType !== null && FORCED_CARD_PENDING_TYPES.has(pendingType)
    const forcedSpec: ActionSpec | undefined = !localControlsActor
      ? undefined
      : snapshot.legalActions.find(
          (spec: ActionSpec): boolean =>
            spec.actor === actorSeat &&
            (answersForcedPending
              ? spec.type === 'resolveEvent'
              : // Eyrie Émigré at the end of Birdsong: a forced turn action.
                pendingType === null && FORCED_CARD_ACTION_TYPES.has(spec.type)),
        )
    if (forcedSpec === undefined) {
      this.forcedCardPromptKey = null
      return
    }
    const key: string = JSON.stringify({
      pending,
      turn: snapshot.state?.turn,
      type: forcedSpec.type,
      params: forcedSpec.params,
    })
    if (key === this.forcedCardPromptKey) {
      return
    }
    this.forcedCardPromptKey = key
    this.deps.applyComposerOutcome(this.deps.composer.begin(forcedSpec))
  }

  private maybeBeginSetupPrompt(
    snapshot: GameSessionSnapshot,
    actorSeat: number,
    localControlsActor: boolean,
  ): void {
    if (!localControlsActor || snapshot.state?.status !== 'setup') {
      this.setupPromptKey = null
      return
    }
    if (!this.deps.isBoardReady()) {
      // Do not lock setupPromptKey — retry after BoardView exists so corner
      // highlights land on a live board (choose keep / starting buildings).
      return
    }
    const setupSpec = snapshot.legalActions.find(
      (spec: ActionSpec) =>
        spec.type === 'resolveEvent' && spec.actor === actorSeat,
    )
    if (setupSpec === undefined) {
      this.setupPromptKey = null
      return
    }
    const pending = snapshot.state.pending[0]
    const key = JSON.stringify({ pending, params: setupSpec.params })
    if (key === this.setupPromptKey) {
      return
    }
    this.setupPromptKey = key
    this.deps.applyComposerOutcome(this.deps.composer.begin(setupSpec))
  }
}
