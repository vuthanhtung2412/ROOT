import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { matchesSuit } from '#cards/suit.js'
import { Deck } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import { defOf } from '#cards/Deck.js'
import { enqueueOutrage } from '#events/outrage.js'
import {
  boardOf,
  discardSupportersOverflow,
} from '#factions/alliance/rules.js'
import { enqueueVagabondDamage } from '#events/vagabondDamage.js'
import { boardOf as vagabondBoardOf } from '#factions/vagabond/items.js'
import {
  discardRandomCultCard,
  lizardBoardOf,
  returnGardenToTrack,
} from '#factions/lizard/rules.js'
import { hasKeep } from '#queries/place.js'
import { playerOf } from '#queries/seat.js'
import { warriorSupplyOf } from '#queries/supply.js'
import { addVictoryPoints } from '#rules/dominance.js'
import { EYRIE_TOTAL_ROOSTS } from '#state/boards.js'
import type { GameState } from '#state/types.js'

/** Rule: Vagabond — full removal clears enemies → damage 3 items instead of pawn. */
const VAGABOND_FULL_REMOVAL_ITEM_DAMAGE = 3

export type PieceRemoval = {
  clearing: ClearingId
  pieceIds: string[]
  scorer?: Seat
  options?: {
    skipFieldHospital?: boolean
    fromBattle?: boolean
    /** The removed pieces belong to the defender of the battle. */
    defendingInBattle?: boolean
  }
}

export function returnWarriorsToSupply(state: GameState, seat: Seat, count: number): void {
  if (count <= 0) return
  const supply = warriorSupplyOf(playerOf(state, seat).board)
  if (supply !== null) supply.warriors += count
}

function returnPieceToOwner(state: GameState, piece: Piece): void {
  const board = playerOf(state, piece.owner).board
  // Rule: Glossary > Return — supply, or rightmost empty track space.
  if (piece.kind === 'warrior') {
    returnWarriorsToSupply(state, piece.owner, 1)
    return
  }
  if (piece.kind === 'token' && piece.type === 'wood' && board.kind === 'marquise') {
    board.supply.wood += 1
    return
  }
  if (piece.kind === 'token' && piece.type === 'keep') {
    // Rule: Marquise > The Keep — token never returns to supply.
    return
  }
  if (piece.kind === 'building' && board.kind === 'marquise') {
    const type = piece.type
    if (type === 'sawmill' || type === 'workshop' || type === 'recruiter') {
      board.tracks[type].placed = Math.min(5, board.tracks[type].placed + 1)
    }
  }
  if (piece.kind === 'building' && piece.type === 'roost' && board.kind === 'eyrie') {
    // Rule: Eyrie — destroyed roosts return to rightmost empty track space (up to all 7).
    board.roostTrack.placed = Math.min(EYRIE_TOTAL_ROOSTS, board.roostTrack.placed + 1)
  }
  if (piece.kind === 'token' && piece.type === 'sympathy' && board.kind === 'alliance') {
    board.sympathyTrack.placed = Math.min(
      10,
      board.sympathyTrack.placed + 1,
    )
  }
}

/** Rule: Alliance — base removed → return to Bases box; discard matching supporters; half officers up; cap 5. */
function applyAllianceBaseRemoval(
  state: GameState,
  seat: Seat,
  clearing: ClearingId,
): void {
  const board = boardOf(state, seat)
  const suit = FALL.clearings[clearing]!.suit
  // Rule: 8.2.4 — removed base returns to Bases box.
  if (!board.bases.includes(suit)) {
    board.bases = [...board.bases, suit]
  }
  const kept: Card[] = []
  const discarded: Card[] = []
  for (const card of board.supporters) {
    const cardSuit = defOf(card).suit
    if (cardSuit === suit || cardSuit === 'bird') {
      discarded.push(card)
    } else {
      kept.push(card)
    }
  }
  board.supporters = kept
  for (const card of discarded) {
    Deck.discard(state.deck, card, {
      onDominance: (dominanceCard) => state.dominanceAvailable.push(dominanceCard),
    })
  }
  const removeOfficers = Math.ceil(board.officers / 2)
  if (removeOfficers > 0) {
    board.officers -= removeOfficers
    board.supply.warriors += removeOfficers
  }
  for (const overflow of discardSupportersOverflow(board)) {
    Deck.discard(state.deck, overflow, {
      onDominance: (dominanceCard) => state.dominanceAvailable.push(dominanceCard),
    })
  }
}

/**
 * Rule: 9.2.9.III — remove warrior → Hostile.
 * Rule: 9.2.9.IIIa Infamy — in battle on your turn, +1 VP per Hostile piece removed
 * except the warrior that made the faction Hostile.
 */
interface VagabondRemoval {
  actor: Seat
  removed: Piece[]
  fromBattle: boolean
}

function applyVagabondHostileAndInfamy(
  state: GameState,
  removal: VagabondRemoval,
  ctx: Ctx | undefined,
  logs: LogEntry[],
): void {
  const { actor, removed, fromBattle } = removal
  const board = vagabondBoardOf(state, actor)
  let infamyPoints = 0
  for (const piece of removed) {
    if (piece.owner === actor) continue
    const faction = playerOf(state, piece.owner).faction
    if (faction === 'vagabond') continue
    const wasHostile = board.relationships[faction] === 'hostile'
    if (piece.kind === 'warrior' && !wasHostile) {
      board.relationships[faction] = 'hostile'
      continue
    }
    if (
      fromBattle &&
      state.currentSeat === actor &&
      board.relationships[faction] === 'hostile'
    ) {
      infamyPoints += 1
    }
  }
  if (infamyPoints <= 0) return
  const scored = addVictoryPoints(state, actor, infamyPoints)
  if (scored > 0) {
    logs.push({ t: 'vp', actor, delta: scored, reason: 'infamy' })
    ctx?.emit({ s: 'vp', actor, delta: scored })
  }
}

/** Rule: Victory — +1 VP per enemy building/token removed. */
export function removePieces(
  state: GameState,
  removal: PieceRemoval,
  ctx?: Ctx,
): LogEntry[] {
  const { clearing, pieceIds, scorer, options } = removal
  const clearingState = state.clearings[clearing]
  if (!clearingState) return []

  const actor = scorer ?? state.currentSeat
  const idSet = new Set(pieceIds)
  const removed: Piece[] = []
  const logs: LogEntry[] = []
  const vagabondSeatsDamaged = new Set<Seat>()

  clearingState.pieces = clearingState.pieces.filter((piece) => {
    if (!idSet.has(piece.id)) return true
    // Rule: Vagabond pawn cannot be removed — full-clear damages items instead.
    if (piece.kind === 'pawn') {
      if (playerOf(state, piece.owner).faction === 'vagabond') {
        vagabondSeatsDamaged.add(piece.owner)
      }
      return true
    }
    removed.push(piece)
    return false
  })

  for (const vagabondSeat of vagabondSeatsDamaged) {
    enqueueVagabondDamage(
      state,
      vagabondSeat,
      VAGABOND_FULL_REMOVAL_ITEM_DAMAGE,
    )
  }

  let victoryPointsDelta = 0
  const victims = new Map<Seat, number>()

  for (const piece of removed) {
    if (piece.kind === 'warrior') {
      victims.set(piece.owner, (victims.get(piece.owner) ?? 0) + 1)
    } else {
      returnPieceToOwner(state, piece)
    }
    if (piece.kind === 'building' && piece.type === 'garden') {
      returnGardenToTrack(state, piece.owner, clearing)
      // Rule: 10.2.5 Fear of the Faithful — discard a random card.
      discardRandomCultCard(state, piece.owner, ctx?.rng)
    }
    if (
      piece.kind === 'building' &&
      piece.type === 'base' &&
      playerOf(state, piece.owner).faction === 'alliance'
    ) {
      applyAllianceBaseRemoval(state, piece.owner, clearing)
    }
    if (
      piece.kind === 'token' &&
      piece.type === 'sympathy' &&
      scorer !== undefined &&
      piece.owner !== scorer
    ) {
      // Rule: Outrage — remove sympathy → offender gives card / Alliance draws.
      enqueueOutrage(state, actor, clearing)
    }
    if (piece.owner === actor) continue
    if (piece.kind === 'building' || piece.kind === 'token') {
      if (piece.kind === 'token' && piece.type === 'keep') {
        // Rule: Marquise > The Keep — token never returns to supply.
        victoryPointsDelta += 1
        continue
      }
      victoryPointsDelta += 1
    }
  }

  // Rule: 9.2.9.III / IIIa — Vagabond Hostile + Infamy (battle on your turn).
  if (playerOf(state, actor).faction === 'vagabond') {
    applyVagabondHostileAndInfamy(
      state,
      { actor, removed, fromBattle: options?.fromBattle === true },
      ctx,
      logs,
    )
  }

  if (victoryPointsDelta > 0) {
    const scored = addVictoryPoints(state, actor, victoryPointsDelta)
    if (scored > 0) {
      logs.push({
        t: 'vp',
        actor,
        delta: scored,
        reason: 'removed building/token',
      })
      ctx?.emit({ s: 'vp', actor, delta: scored })
    }

    // Rule: 7.8.4 Despot — in battle, ≥1 enemy building/token → +1 extra VP.
    if (options?.fromBattle === true) {
      const board = playerOf(state, actor).board
      if (board.kind === 'eyrie' && board.leader === 'despot') {
        const despotScored = addVictoryPoints(state, actor, 1)
        if (despotScored > 0) {
          logs.push({ t: 'vp', actor, delta: despotScored, reason: 'despot' })
          ctx?.emit({ s: 'vp', actor, delta: despotScored })
        }
      }
    }
  }

  for (const [victim, count] of victims) {
    if (count <= 0) continue
    const faction = playerOf(state, victim).faction
    const skipHospital =
      !hasKeep(state, victim) || options?.skipFieldHospital === true
    const canOfferHospital =
      !skipHospital && victimHasFieldHospitalCard(state, victim, clearing)
    // Rule: 10.2.3 Revenge — Cult warriors removed while defending become acolytes.
    const becomeAcolytes =
      faction === 'lizard' && options?.defendingInBattle === true
    const sentToSupply = !canOfferHospital && !becomeAcolytes

    if (becomeAcolytes) {
      lizardBoardOf(state, victim).acolytes += count
    } else if (sentToSupply) {
      returnWarriorsToSupply(state, victim, count)
    } else {
      state.pending.push({
        type: 'fieldHospital',
        victim,
        clearing,
        count,
      })
    }

    ctx?.emit({
      s: 'warriors.removed',
      victim,
      faction,
      clearing,
      count,
      toSupply: sentToSupply,
    })
  }

  if (removed.length > 0) {
    logs.push({ t: 'pieces', clearing, removed })
  }

  return logs
}

/** True when victim holds a card matching the clearing suit (or bird). */
function victimHasFieldHospitalCard(
  state: GameState,
  victim: Seat,
  clearing: ClearingId,
): boolean {
  const suit = FALL.clearings[clearing]?.suit
  if (suit === undefined) {
    return false
  }
  return playerOf(state, victim).hand.some((card) => matchesSuit(card, suit))
}
