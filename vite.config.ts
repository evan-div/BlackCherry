import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// Two build targets, selected via `--mode lib`:
//  - default: the demo/dev site (index.html) plus the iframe-embed page (embed.html)
//  - lib: the npm package build (src/index.ts) consumed via `mount()` or the
//    <TradeShowExplorer/> component — see README for embedding instructions.
export default defineConfig(({ mode }) => {
  if (mode === 'lib') {
    return {
      plugins: [react()],
      // Vite's library mode does NOT inline process.env.NODE_ENV by default — it
      // assumes a downstream bundler will handle that. We explicitly want this
      // bundle loadable via a plain <script type="module"> with NO bundler at all
      // (the primary embed path), so `process` must never appear at runtime.
      define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      build: {
        outDir: 'dist-lib',
        lib: {
          entry: r('src/index.ts'),
          name: 'TradeShowExplorer',
          formats: ['es'],
          fileName: () => 'trade-show-explorer.js',
        },
        // React is intentionally bundled (not externalized) so a host page needs
        // zero framework knowledge — just a container element and mount().
      },
    }
  }

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          main: r('index.html'),
          embed: r('embed.html'),
        },
      },
    },
  }
})
