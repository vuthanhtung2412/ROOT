import Phaser from 'phaser'

/** Bridge for React ↔ Phaser scene communication (template-react pattern). */
export const EventBus = new Phaser.Events.EventEmitter()
