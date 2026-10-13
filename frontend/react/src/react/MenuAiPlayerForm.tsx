import { useState, useSyncExternalStore, type JSX } from 'react'
import type { AddAiPlayerInput } from '#api/client.ts'
import {
  getAiPlayerSnapshot,
  modelDisplayName,
  subscribeAiPlayers,
  type AiPlayerStoreState,
} from '#game/aiPlayerStore.ts'
import type { MenuFactionChoice } from '#game/hudStore.ts'
import { factionDisplayName, isMenuFactionId } from '#game/menuPartySetup.ts'
import {
  SECONDARY_BUTTON_CLASS_NAME,
  SECTION_TITLE_CLASS_NAME,
} from '#react/MenuParts.tsx'

const SELECT_CLASS_NAME =
  'w-full border-2 border-ink bg-parchment px-2 py-1.5 font-body text-base text-ink'
const FIELD_CLASS_NAME = 'flex min-w-0 flex-1 flex-col gap-0.5'
const FIELD_LABEL_CLASS_NAME = 'font-body text-sm text-ink-soft'

function factionName(factionId: string): string {
  return isMenuFactionId(factionId) ? factionDisplayName(factionId) : factionId
}

/**
 * Host only: seat an AI player. The model list comes from the server; with no
 * model configured there the form is not shown.
 */
export function MenuAiPlayerForm(props: {
  /** Open lobby: factions to choose from. Empty when seats are preset. */
  factionChoices: readonly MenuFactionChoice[]
  disabled: boolean
  onAdd: (input: AddAiPlayerInput) => void
}): JSX.Element | null {
  const aiPlayerStore: AiPlayerStoreState = useSyncExternalStore(
    subscribeAiPlayers,
    getAiPlayerSnapshot,
    getAiPlayerSnapshot,
  )
  const [pickedModel, setPickedModel] = useState<string | null>(null)
  const [pickedFaction, setPickedFaction] = useState<string | null>(null)

  const freeFactions: string[] = props.factionChoices
    .filter((choice: MenuFactionChoice): boolean => choice.takenBy === null)
    .map((choice: MenuFactionChoice): string => choice.faction)
  const isOpenLobby: boolean = props.factionChoices.length > 0
  const model: string | null =
    pickedModel !== null && aiPlayerStore.models.includes(pickedModel)
      ? pickedModel
      : (aiPlayerStore.defaultModel ?? aiPlayerStore.models[0] ?? null)
  const faction: string | null =
    pickedFaction !== null && freeFactions.includes(pickedFaction)
      ? pickedFaction
      : (freeFactions[0] ?? null)

  if (model === null) {
    return null
  }
  const canAdd: boolean = !isOpenLobby || faction !== null

  return (
    <fieldset
      className="menu-ai-player m-0 flex w-full flex-col gap-2 border-0 p-0"
      disabled={props.disabled}
    >
      <legend className={`mb-1 ${SECTION_TITLE_CLASS_NAME}`}>
        Add an AI player
      </legend>
      <div className="flex flex-row flex-wrap items-end gap-2">
        {isOpenLobby && faction !== null ? (
          <label className={FIELD_CLASS_NAME}>
            <span className={FIELD_LABEL_CLASS_NAME}>Faction</span>
            <select
              className={`menu-ai-player-faction ${SELECT_CLASS_NAME}`}
              value={faction}
              onChange={(event): void => {
                setPickedFaction(event.target.value)
              }}
            >
              {freeFactions.map(
                (factionId: string): JSX.Element => (
                  <option key={factionId} value={factionId}>
                    {factionName(factionId)}
                  </option>
                ),
              )}
            </select>
          </label>
        ) : null}
        <label className={FIELD_CLASS_NAME}>
          <span className={FIELD_LABEL_CLASS_NAME}>Model</span>
          <select
            className={`menu-ai-player-model ${SELECT_CLASS_NAME}`}
            value={model}
            onChange={(event): void => {
              setPickedModel(event.target.value)
            }}
          >
            {aiPlayerStore.models.map(
              (offeredModel: string): JSX.Element => (
                <option key={offeredModel} value={offeredModel}>
                  {modelDisplayName(offeredModel)}
                </option>
              ),
            )}
          </select>
        </label>
        <button
          type="button"
          className={`menu-ai-player-add ${SECONDARY_BUTTON_CLASS_NAME}`}
          disabled={!canAdd}
          title={canAdd ? undefined : 'Every faction is taken'}
          onClick={(): void => {
            props.onAdd({
              model,
              ...(isOpenLobby && faction !== null ? { faction } : {}),
            })
          }}
        >
          Add AI
        </button>
      </div>
    </fieldset>
  )
}
