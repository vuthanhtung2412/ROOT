import type { Game } from '@root/lib'
import {
  ACT_TOOL_NAME,
  type AiPlayerToolContext,
  type JsonValue,
} from '#aiPlayer/aiPlayerTools.js'
import type {
  ModelConversation,
  ModelConversationRequest,
  ModelInput,
  ModelProvider,
  ModelReply,
  ModelStopReason,
} from '#aiPlayer/ModelProvider.js'
import type { RuleSection } from '#aiPlayer/rulebook.js'
import { listPlayerLegalActions } from '#view/playerView.js'

/** Builds the next model reply from the message the model just received. */
export type ScriptedReply = (input: ModelInput) => ModelReply

export type ScriptedConversation = {
  conversation: ModelConversation
  /** Every message the model received, oldest first. */
  inputs: ModelInput[]
}

const TEST_RULEBOOK: readonly RuleSection[] = [
  { sectionNumber: '4.3', title: 'Battle', text: 'Roll two dice.' },
]

let nextCallNumber = 0

export function toolCallReply(name: string, input: JsonValue): ModelReply {
  nextCallNumber += 1
  return {
    stopReason: 'toolCalls',
    toolCalls: [{ callId: `call-${String(nextCallNumber)}`, name, input }],
    text: '',
  }
}

export function stoppedReply(stopReason: ModelStopReason): ModelReply {
  return { stopReason, toolCalls: [], text: '' }
}

/**
 * Model that answers the first pending setup choice of its seat (keep corner,
 * starting building, leader), or ends its reply when the seat has none.
 */
export function answerSetupChoiceReply(game: Game, playerId: string): ModelReply {
  const params = listPlayerLegalActions(game, playerId)[0]?.params
  const clearing = params?.clearing?.[0]
  const leader = params?.leaders?.[0]
  if (typeof clearing === 'number') {
    return toolCallReply(ACT_TOOL_NAME, {
      action: { type: 'resolveEvent', clearing },
    })
  }
  if (typeof leader === 'string') {
    return toolCallReply(ACT_TOOL_NAME, {
      action: { type: 'resolveEvent', leader },
    })
  }
  return stoppedReply('finished')
}

/** Replies come from `script` in order; the last entry repeats forever. */
export function createScriptedConversation(
  script: readonly ScriptedReply[],
): ScriptedConversation {
  const inputs: ModelInput[] = []
  const conversation: ModelConversation = {
    send(input: ModelInput, abortSignal: AbortSignal): Promise<ModelReply> {
      abortSignal.throwIfAborted()
      const scripted = script[Math.min(inputs.length, script.length - 1)]
      inputs.push(input)
      if (scripted === undefined) {
        return Promise.reject(new Error('empty conversation script'))
      }
      return Promise.resolve(scripted(input))
    },
  }
  return { conversation, inputs }
}

export type ScriptedProvider = {
  provider: ModelProvider
  /** One entry per conversation the provider was asked to start. */
  requests: ModelConversationRequest[]
  conversations: ScriptedConversation[]
}

/** Provider whose every conversation follows a fresh copy of `script`. */
export function createScriptedProvider(
  script: readonly ScriptedReply[],
): ScriptedProvider {
  const requests: ModelConversationRequest[] = []
  const conversations: ScriptedConversation[] = []
  const provider: ModelProvider = {
    startConversation(request: ModelConversationRequest): ModelConversation {
      const scripted = createScriptedConversation(script)
      requests.push(request)
      conversations.push(scripted)
      return scripted.conversation
    },
  }
  return { provider, requests, conversations }
}

export function createToolContext(
  game: Game,
  playerId: string,
  onGameChanged: () => void = (): void => {},
): AiPlayerToolContext {
  return { game, playerId, rulebook: TEST_RULEBOOK, onGameChanged }
}
