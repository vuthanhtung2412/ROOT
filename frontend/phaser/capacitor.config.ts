import type { CapacitorConfig } from '@capacitor/cli/dist/declarations.js'

const config: CapacitorConfig = {
  appId: 'com.root.phaser',
  appName: 'ROOT',
  webDir: 'dist',
  server: {
    /** Allow http:// LAN API base for local multiplayer. */
    cleartext: true,
  },
}

export default config
