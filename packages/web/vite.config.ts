import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { minimal2023Preset } from '@vite-pwa/assets-generator/presets'

// The maskable icon's safe-zone padding defaults to a white backdrop, which
// would show as a mismatched ring on OS shapes that reveal it. Match it to
// the icon's felt-green background instead.
const pwaAssetsPreset = {
  ...minimal2023Preset,
  maskable: {
    ...minimal2023Preset.maskable,
    resizeOptions: { fit: 'contain' as const, background: '#0b6b43' },
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      pwaAssets: {
        // Generates favicon/apple-touch-icon/maskable icons from this one
        // source image and injects the matching <link> tags automatically.
        image: 'public/favicon.svg',
        preset: pwaAssetsPreset,
      },
      manifest: {
        name: '28 - The Kerala Card Game',
        short_name: '28',
        description: 'Play 28, the classic Kerala trick-taking card game, solo against bots or online with friends.',
        theme_color: '#0b6b43',
        background_color: '#06170f',
        display: 'standalone',
        start_url: '.',
        scope: '.',
      },
      // Default globPatterns (js/css/html) plus the zero-config icon/manifest
      // injection already cover the whole app shell for offline play, since
      // single-player mode needs no network. Online multiplayer still needs
      // a live connection to the game server.
    }),
  ],
  // Relative base so the build works when served from a GitHub Pages
  // project subpath (https://<user>.github.io/<repo>/) with no extra config.
  base: './',
})
