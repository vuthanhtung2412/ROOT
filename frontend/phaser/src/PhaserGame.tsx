import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type Ref,
} from 'react'
import Phaser from 'phaser'
import { EventBus } from '#game/EventBus.ts'
import { startGame } from '#game/startGame.ts'

export type PhaserGameHandle = {
  game: Phaser.Game | null
  scene: Phaser.Scene | null
}

export type PhaserGameProps = {
  currentActiveScene?: (scene: Phaser.Scene) => void
}

export const PhaserGame = forwardRef(function PhaserGame(
  props: PhaserGameProps,
  ref: Ref<PhaserGameHandle>,
) {
  const gameRef = useRef<Phaser.Game | undefined>(undefined)
  const sceneRef = useRef<Phaser.Scene | null>(null)

  useImperativeHandle(ref, () => ({
    get game(): Phaser.Game | null {
      return gameRef.current ?? null
    },
    get scene(): Phaser.Scene | null {
      return sceneRef.current
    },
  }))

  useLayoutEffect(() => {
    if (gameRef.current !== undefined) {
      return
    }

    gameRef.current = startGame('game-container')
    window.__ROOT_PHASER_GAME__ = gameRef.current

    return () => {
      if (gameRef.current !== undefined) {
        gameRef.current.destroy(true)
        gameRef.current = undefined
        delete window.__ROOT_PHASER_GAME__
      }
    }
  }, [])

  useEffect(() => {
    const onSceneReady = (currentScene: Phaser.Scene): void => {
      sceneRef.current = currentScene
      if (props.currentActiveScene !== undefined) {
        props.currentActiveScene(currentScene)
      }
    }

    EventBus.on('current-scene-ready', onSceneReady)
    return () => {
      EventBus.off('current-scene-ready', onSceneReady)
    }
  }, [props.currentActiveScene])

  return <div id="game-container" />
})
