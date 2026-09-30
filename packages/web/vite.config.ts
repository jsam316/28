import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv, type Plugin } from 'vite'
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

// Build stamp shown on the home screen so anyone can tell which build they
// are running: package version, short commit and build date.
function buildStamp() {
  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
  let sha = (process.env.GITHUB_SHA ?? '').slice(0, 7)
  if (!sha) {
    try {
      sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    } catch {
      sha = 'dev'
    }
  }
  return { version, sha, date: new Date().toISOString().slice(0, 10) }
}

const stamp = buildStamp()

// Content Security Policy for the production build. Scripts, styles and the
// service worker may only come from the site itself, and the page may only
// talk to itself and the game server - so even if an attacker got markup
// into the page they could not load outside code or send data anywhere else.
function cspPlugin(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      const server = process.env.VITE_SERVER_URL ?? loadEnv('production', process.cwd(), 'VITE_').VITE_SERVER_URL ?? ''
      let connect = "'self'"
      try {
        if (server) {
          const u = new URL(server)
          const ws = u.protocol === 'https:' ? 'wss:' : 'ws:'
          connect += ` ${u.origin} ${ws}//${u.host}`
        }
      } catch {
        // No valid server URL: online play is simply blocked by the policy.
      }
      const policy = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        `connect-src ${connect}`,
        "worker-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
      ].join('; ')
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />\n    <meta name="referrer" content="no-referrer" />`
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(stamp.version),
    __BUILD_SHA__: JSON.stringify(stamp.sha),
    __BUILD_DATE__: JSON.stringify(stamp.date),
  },
  plugins: [
    react(),
    cspPlugin(),
    VitePWA({
      // The app decides when to apply an update (see UpdateToast): it reloads
      // itself on the home screen and offers a Reload button mid-game.
      registerType: 'prompt',
      pwaAssets: {
        // Generates favicon/apple-touch-icon/maskable icons from this one
        // source image and injects the matching <link> tags automatically.
        image: 'public/favicon.svg',
        preset: pwaAssetsPreset,
      },
      manifest: {
        name: '28 - The Kerala Card Game',
        short_name: '28',
        description: 'Play 28, the classic Kerala card game, solo against bots or online with friends.',
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
